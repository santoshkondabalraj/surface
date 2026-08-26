"use client";

import { useState } from "react";

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  users: string[];
  roles: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
  groups: string[];
  roles: string[];
}

interface RbacPanelProps {
  // No subsection needed - displays all 5 functions in tabs
}

const BRAND_COLOR = {
  light: "text-slate-700",
  border: "border-slate-200",
  bg: "bg-slate-50/30",
  dark: "text-slate-300",
};

const AVAILABLE_PERMISSIONS = [
  "read_orders",
  "create_orders",
  "edit_orders",
  "delete_orders",
  "view_inventory",
  "manage_inventory",
  "view_reports",
  "generate_reports",
  "manage_users",
  "manage_roles",
  "view_system_logs",
  "configure_system",
];

const RBAC_TABS = [
  { id: "roles", label: "Manage Roles", icon: "👥" },
  { id: "permissions", label: "Assign Permissions", icon: "🔑" },
  { id: "users", label: "Manage Users", icon: "👤" },
  { id: "groups", label: "User Groups", icon: "👥" },
  { id: "group-roles", label: "Group Roles", icon: "🔗" },
];

export default function RbacPanel({}: RbacPanelProps) {
  const [activeTab, setActiveTab] = useState<string>("roles");
  const [roles, setRoles] = useState<Role[]>([
    {
      id: "1",
      name: "Admin",
      description: "Full system access",
      permissions: AVAILABLE_PERMISSIONS,
    },
    {
      id: "2",
      name: "Analyst",
      description: "Read-only access to reports and inventory",
      permissions: ["view_orders", "view_inventory", "view_reports"],
    },
  ]);

  const [groups, setGroups] = useState<UserGroup[]>([
    {
      id: "1",
      name: "Operations Team",
      description: "Order management team",
      users: ["user1", "user2"],
      roles: ["2"],
    },
  ]);

  const [users, setUsers] = useState<User[]>([
    {
      id: "user1",
      name: "John Doe",
      email: "john@example.com",
      groups: ["1"],
      roles: ["2"],
    },
    {
      id: "user2",
      name: "Jane Smith",
      email: "jane@example.com",
      groups: ["1"],
      roles: ["2"],
    },
  ]);

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");

  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const newRole: Role = {
      id: Date.now().toString(),
      name: newRoleName,
      description: newRoleDesc,
      permissions: selectedPermissions,
    };
    setRoles([...roles, newRole]);
    setNewRoleName("");
    setNewRoleDesc("");
    setSelectedPermissions([]);
  };

  const handleDeleteRole = (roleId: string) => {
    setRoles(roles.filter((r) => r.id !== roleId));
  };

  const handleTogglePermission = (permission: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup: UserGroup = {
      id: Date.now().toString(),
      name: newGroupName,
      description: newGroupDesc,
      users: [],
      roles: [],
    };
    setGroups([...groups, newGroup]);
    setNewGroupName("");
    setNewGroupDesc("");
  };

  const handleDeleteGroup = (groupId: string) => {
    setGroups(groups.filter((g) => g.id !== groupId));
  };

  const handleAssignRoleToGroup = (groupId: string, roleId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              roles: g.roles.includes(roleId)
                ? g.roles.filter((r) => r !== roleId)
                : [...g.roles, roleId],
            }
          : g
      )
    );
  };

  const handleAddUser = () => {
    if (!newUserName.trim() || !newUserEmail.trim()) return;
    const newUser: User = {
      id: Date.now().toString(),
      name: newUserName,
      email: newUserEmail,
      groups: [],
      roles: [],
    };
    setUsers([...users, newUser]);
    setNewUserName("");
    setNewUserEmail("");
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((u) => u.id !== userId));
  };

  const handleAddUserToGroup = (userId: string, groupId: string) => {
    setUsers(
      users.map((u) =>
        u.id === userId
          ? {
              ...u,
              groups: u.groups.includes(groupId)
                ? u.groups.filter((g) => g !== groupId)
                : [...u.groups, groupId],
            }
          : u
      )
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 overflow-x-auto">
        <div className="flex gap-1 p-2 min-w-min">
          {RBAC_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-600"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl">
          {/* Manage Roles Tab */}
          {activeTab === "roles" && (
            <>
              <div className={`${BRAND_COLOR.bg} dark:bg-slate-800/30 rounded-lg p-6 mb-6 border ${BRAND_COLOR.border} dark:border-slate-700`}>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Create New Role</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Role name (e.g., Manager)"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <textarea
                    placeholder="Role description"
                    value={newRoleDesc}
                    onChange={(e) => setNewRoleDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                      Select Permissions
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm)}
                            onChange={() => handleTogglePermission(perm)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                          <span className="capitalize">{perm.replace(/_/g, " ")}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={handleAddRole}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-xs transition-colors"
                  >
                    Create Role
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Existing Roles</h2>
                <div className="space-y-3">
                  {roles.map((role) => (
                    <div
                      key={role.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{role.name}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{role.description}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {role.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full"
                          >
                            {perm.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Assign Permissions Tab */}
          {activeTab === "permissions" && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Assign Permissions to Roles</h2>
              <div className="space-y-4">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                  >
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{role.name}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={role.permissions.includes(perm)}
                            className="rounded w-4 h-4 cursor-pointer"
                            disabled
                          />
                          <span className="capitalize">{perm.replace(/_/g, " ")}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manage Users Tab */}
          {activeTab === "users" && (
            <>
              <div className={`${BRAND_COLOR.bg} dark:bg-slate-800/30 rounded-lg p-6 mb-6 border ${BRAND_COLOR.border} dark:border-slate-700`}>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add New User</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={handleAddUser}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-xs transition-colors"
                  >
                    Add User
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Users</h2>
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{user.name}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{user.email}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {user.groups.map((groupId) => {
                          const group = groups.find((g) => g.id === groupId);
                          return (
                            <span
                              key={groupId}
                              className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full"
                            >
                              {group?.name || "Unknown Group"}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* User Groups Tab */}
          {activeTab === "groups" && (
            <>
              <div className={`${BRAND_COLOR.bg} dark:bg-slate-800/30 rounded-lg p-6 mb-6 border ${BRAND_COLOR.border} dark:border-slate-700`}>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Create New Group</h2>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Group name (e.g., Sales Team)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <textarea
                    placeholder="Group description"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={2}
                  />
                  <button
                    onClick={handleAddGroup}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-xs transition-colors"
                  >
                    Create Group
                  </button>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Existing Groups</h2>
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{group.name}</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{group.description}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                          {group.users.length} users
                        </span>
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                          {group.roles.length} roles
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Group Roles Tab */}
          {activeTab === "group-roles" && (
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Assign Roles to Groups</h2>
              <div className="space-y-4">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800/50"
                  >
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{group.name}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {roles.map((role) => (
                        <label
                          key={role.id}
                          className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 dark:text-slate-400 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/30 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={group.roles.includes(role.id)}
                            onChange={() => handleAssignRoleToGroup(group.id, role.id)}
                            className="rounded w-4 h-4 cursor-pointer"
                          />
                          <span>{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
