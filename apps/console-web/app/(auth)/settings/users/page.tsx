"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatDateTime } from "@/lib/format-date";
import { apiClient } from "../../../../lib/api-client";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  lastLogin: string | null;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

type MergedRow =
  | { kind: "user"; user: User }
  | { kind: "pending"; invitation: Invitation };

const ROLES = ["admin", "operator", "developer", "viewer"] as const;

function roleBadgeVariant(role: string) {
  switch (role) {
    case "admin":
      return "destructive" as const;
    case "operator":
      return "default" as const;
    case "developer":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");

  async function fetchUsers() {
    try {
      const res = await apiClient.get<{ data: User[] }>("/users");
      setUsers(res.data);
    } catch {
      // Could not fetch users
    }
  }

  async function fetchInvitations() {
    try {
      const res = await apiClient.get<{ data: Invitation[] }>("/users/invitations");
      setPendingInvitations(res.data);
    } catch {
      // Could not fetch invitations
    }
  }

  async function fetchAll() {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchInvitations()]);
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleInvite() {
    try {
      await apiClient.post("/users/invite", {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("viewer");
      fetchAll();
    } catch {
      // Handle error
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await apiClient.patch(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch {
      // Handle error
    }
  }

  async function handleRemove() {
    if (!selectedUser) return;
    try {
      await apiClient.delete(`/users/${selectedUser.id}`);
      setRemoveOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch {
      // Handle error
    }
  }

  // Merge users and pending invitations
  const rows: MergedRow[] = [
    ...users.map((u) => ({ kind: "user" as const, user: u })),
    ...pendingInvitations.map((i) => ({
      kind: "pending" as const,
      invitation: i,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="mt-1 text-gray-600">
            Manage team members and their roles.
          </p>
        </div>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>Invite User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite User</DialogTitle>
              <DialogDescription>
                Send an invitation link to join your organization. The user will
                create their account when they accept.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleInvite}>Send Invite</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold">Team Members</h2>
            <p className="text-sm text-muted-foreground">
              {users.length} active user(s) and {pendingInvitations.length} pending
              invitation(s).
            </p>
          </div>
        </div>
        <div className="rounded-md border">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  if (row.kind === "user") {
                    const user = row.user;
                    return (
                      <TableRow key={`user-${user.id}`}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Badge
                                variant={roleBadgeVariant(user.role)}
                                className="cursor-pointer"
                              >
                                {user.role}
                              </Badge>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {ROLES.map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  onClick={() => handleRoleChange(user.id, r)}
                                  disabled={r === user.role}
                                >
                                  {r.charAt(0).toUpperCase() + r.slice(1)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-700">
                            Active
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.lastLogin
                            ? formatDateTime(user.lastLogin)
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setRemoveOpen(true);
                            }}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const inv = row.invitation;
                  return (
                    <TableRow key={`inv-${inv.id}`}>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell className="text-muted-foreground italic">
                        --
                      </TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(inv.role)}>
                          {inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-700">
                          Pending
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        Expires{" "}
                        {formatDate(inv.expiresAt)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          Awaiting acceptance
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedUser?.name} (
              {selectedUser?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
