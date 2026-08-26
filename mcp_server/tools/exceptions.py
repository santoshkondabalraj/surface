"""Sterling OMS YFS_REPROCESS_ERROR exception table tool — direct Oracle SQL."""
import os
import oracledb

_DB_HOST = os.getenv("OMS_DB_HOST", "localhost")
_DB_PORT = int(os.getenv("OMS_DB_PORT", "1521"))
_DB_SID = os.getenv("OMS_DB_SID", "ORCL")
_DB_USER = os.getenv("OMS_DB_USER", "TRAINING")
_DB_PASSWORD = os.getenv("OMS_DB_PASSWORD", "Passw0rd")

_COLUMNS = [
    "ERRORTXNID",
    "FLOW_NAME",
    "SUB_FLOW_NAME",
    "STATE",
    "ERRORCODE",
    "EXCEPTION_GROUP_NAME",
    "EXCEPTIONID",
    "EXCEPTIONGROUPID",
    "QUEUEID",
    "ERRORSTRING",
    "ERROR_REFERENCE",
    "YANTRAMESSAGEID",
    "UNIQUEKEY",
    "PARENTTXNID",
    "ERRORMESSAGE",
    "CREATEUSERID",
    "MODIFYUSERID",
    "CREATEPROGID",
    "MODIFYPROGID",
    "CREATETS",
    "MODIFYTS",
    "MESSAGE",
]


def _serialize(val):
    if val is None:
        return None
    if isinstance(val, oracledb.LOB):
        return val.read()
    return str(val)


def _connect():
    dsn = oracledb.makedsn(_DB_HOST, _DB_PORT, sid=_DB_SID)
    return oracledb.connect(user=_DB_USER, password=_DB_PASSWORD, dsn=dsn)


def register_exception_tools(mcp):
    @mcp.tool()
    def get_reprocess_errors(
        errortxnid: str = "",
        flow_name: str = "",
        flow_name_match: str = "exact",
        sub_flow_name: str = "",
        state: str = "",
        errorcode: str = "",
        exception_group_name: str = "",
        exceptionid: str = "",
        exceptiongroupid: str = "",
        error_reference: str = "",
        createts_from: str = "",
        createts_to: str = "",
        max_records: int = 50,
    ) -> dict:
        """Query the Sterling OMS YFS_REPROCESS_ERROR exception table directly from Oracle.

        All filters are optional — omit any to skip that filter.

        Args:
            errortxnid: Exact match on primary key ERRORTXNID.
            flow_name: Filter by FLOW_NAME (service/flow that produced the error).
            flow_name_match: How to match flow_name — "exact", "contains", or "starts_with" (default "exact").
            sub_flow_name: Exact match on SUB_FLOW_NAME (sub-flow or RuntimeID).
            state: Filter by STATE — one of: Initial, Saved, Modified, Fixed, Ignore.
            errorcode: Exact match on ERRORCODE.
            exception_group_name: Exact match on EXCEPTION_GROUP_NAME.
            exceptionid: Exact match on EXCEPTIONID (PK of related alert in YFS_INBOX).
            exceptiongroupid: Exact match on EXCEPTIONGROUPID.
            error_reference: Substring search on ERROR_REFERENCE (name/value pairs).
            createts_from: Start of CREATETS range — format "YYYY-MM-DD HH24:MI:SS".
            createts_to: End of CREATETS range — format "YYYY-MM-DD HH24:MI:SS".
            max_records: Maximum rows to return (default 50, max 500).

        Returns:
            dict with keys:
              "rows" — list of dicts, one per error record
              "count" — number of rows returned
              "error" — error message string if the query failed, else None
        """
        max_records = min(max_records, 500)

        where: list[str] = []
        params: dict[str, str] = {}

        if errortxnid:
            where.append("ERRORTXNID = :errortxnid")
            params["errortxnid"] = errortxnid

        if flow_name:
            match = flow_name_match.lower()
            if match == "contains":
                where.append("FLOW_NAME LIKE :flow_name")
                params["flow_name"] = f"%{flow_name}%"
            elif match == "starts_with":
                where.append("FLOW_NAME LIKE :flow_name")
                params["flow_name"] = f"{flow_name}%"
            else:
                where.append("FLOW_NAME = :flow_name")
                params["flow_name"] = flow_name

        if sub_flow_name:
            where.append("SUB_FLOW_NAME = :sub_flow_name")
            params["sub_flow_name"] = sub_flow_name

        if state:
            where.append("STATE = :state")
            params["state"] = state

        if errorcode:
            where.append("ERRORCODE = :errorcode")
            params["errorcode"] = errorcode

        if exception_group_name:
            where.append("EXCEPTION_GROUP_NAME = :exception_group_name")
            params["exception_group_name"] = exception_group_name

        if exceptionid:
            where.append("EXCEPTIONID = :exceptionid")
            params["exceptionid"] = exceptionid

        if exceptiongroupid:
            where.append("EXCEPTIONGROUPID = :exceptiongroupid")
            params["exceptiongroupid"] = exceptiongroupid

        if error_reference:
            where.append("ERROR_REFERENCE LIKE :error_reference")
            params["error_reference"] = f"%{error_reference}%"

        if createts_from and createts_to:
            where.append(
                "CREATETS BETWEEN TO_TIMESTAMP(:createts_from, 'YYYY-MM-DD HH24:MI:SS')"
                " AND TO_TIMESTAMP(:createts_to, 'YYYY-MM-DD HH24:MI:SS')"
            )
            params["createts_from"] = createts_from
            params["createts_to"] = createts_to
        elif createts_from:
            where.append("CREATETS >= TO_TIMESTAMP(:createts_from, 'YYYY-MM-DD HH24:MI:SS')")
            params["createts_from"] = createts_from
        elif createts_to:
            where.append("CREATETS <= TO_TIMESTAMP(:createts_to, 'YYYY-MM-DD HH24:MI:SS')")
            params["createts_to"] = createts_to

        col_list = ", ".join(_COLUMNS)
        sql = f"SELECT {col_list} FROM YFS_REPROCESS_ERROR"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY CREATETS DESC"
        sql += f" FETCH FIRST {max_records} ROWS ONLY"

        try:
            with _connect() as conn:
                with conn.cursor() as cur:
                    cur.execute(sql, params)
                    col_names = [d[0] for d in cur.description]
                    rows = [
                        {col_names[i]: _serialize(val) for i, val in enumerate(row)}
                        for row in cur.fetchall()
                    ]
            return {"rows": rows, "count": len(rows), "error": None}
        except Exception as exc:
            return {"rows": [], "count": 0, "error": str(exc)}
