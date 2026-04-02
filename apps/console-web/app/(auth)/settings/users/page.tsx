"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortableTableHead, useTableSort } from "@/components/ui/sortable-table-head";
import {
  MoreHorizontal,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { formatDateTime } from "@/lib/format-date";
import { apiClient } from "@/lib/api-client";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  last_login: string | null;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
}

type MergedRow =
  | { kind: "user"; data: User }
  | { kind: "pending"; data: Invitation };

const ROLES = ["admin", "operator", "developer", "viewer"] as const;

function roleBadgeVariant(_role: string) {
  return "outline" as const;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const currentUserId = (session as any)?.userId ?? "";

  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "invite">("create");
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<string>("viewer");
  const [formPassword, setFormPassword] = useState("");

  // Filters
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);

  const { sortKey, sortDirection, handleSort, sortData } = useTableSort();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, invRes] = await Promise.all([
        apiClient.get<{ data: User[] }>("/users"),
        apiClient.get<{ data: Invitation[] }>("/users/invitations"),
      ]);
      setUsers(usersRes.data ?? []);
      setInvitations(invRes.data ?? []);
    } catch {
      setUsers([]);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Merge + search + sort
  const rows = useMemo(() => {
    const merged: MergedRow[] = [
      ...users.map((u) => ({ kind: "user" as const, data: u })),
      ...invitations.map((i) => ({ kind: "pending" as const, data: i })),
    ];

    let filtered = merged;

    // Search
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((r) => {
        const email = r.data.email.toLowerCase();
        const name = r.kind === "user" ? r.data.name.toLowerCase() : "";
        return email.includes(q) || name.includes(q);
      });
    }

    // Filter by role
    if (filterRole !== "all") {
      filtered = filtered.filter((r) => r.data.role === filterRole);
    }

    // Filter by status
    if (filterStatus !== "all") {
      filtered = filtered.filter((r) =>
        filterStatus === "active" ? r.kind === "user" : r.kind === "pending",
      );
    }

    return sortData(filtered, (r: MergedRow, key: string) => {
      if (key === "email") return r.data.email;
      if (key === "name") return r.kind === "user" ? r.data.name : "";
      if (key === "role") return r.data.role;
      if (key === "status") return r.kind;
      return null;
    });
  }, [users, invitations, search, filterRole, filterStatus, sortData]);

  // Actions
  function openCreate() {
    setDialogMode("create");
    setFormEmail(""); setFormName(""); setFormRole("viewer"); setFormPassword("");
    setDialogOpen(true);
  }

  function openInvite() {
    setDialogMode("invite");
    setFormEmail(""); setFormName(""); setFormRole("viewer"); setFormPassword("");
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formEmail) return;
    try {
      if (dialogMode === "create") {
        await apiClient.post("/users/create", {
          email: formEmail, name: formName || formEmail.split("@")[0], role: formRole,
          ...(formPassword ? { password: formPassword } : {}),
        });
        toast.success("User created");
      } else {
        await apiClient.post("/users/invite", { email: formEmail, role: formRole });
        toast.success("Invitation sent");
      }
      setDialogOpen(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      await apiClient.patch(`/users/${userId}/role`, { role: newRole });
      toast.success("Role updated");
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to change role");
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    try {
      await apiClient.delete(`/users/${removeTarget.id}`);
      toast.success("User removed");
      setRemoveTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to remove user");
    }
  }

  async function handleCancelInvitation(id: string) {
    try {
      await apiClient.delete(`/users/invitations/${id}`);
      toast.success("Invitation cancelled");
      fetchAll();
    } catch { toast.error("Failed to cancel invitation"); }
  }

  async function handleResendInvitation(id: string) {
    try {
      await apiClient.post(`/users/invitations/${id}/resend`, {});
      toast.success("Invitation resent");
    } catch { toast.error("Failed to resend invitation"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage team members and their roles.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openInvite}>
            Invite
          </Button>
          <Button onClick={openCreate}>
            <UserPlus className="mr-2 size-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        {users.length} active user(s) and {invitations.length} pending invitation(s).
      </p>

      {/* Filters + Search row */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[250px]"
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-muted-foreground">
          Loading users...
        </div>
      ) : rows.length === 0 && !search ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No team members yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add users or send invitations to get started.
          </p>
          <Button className="mt-4" onClick={openCreate}>Add User</Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="email" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Email</SortableTableHead>
                <SortableTableHead sortKey="name" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Name</SortableTableHead>
                <SortableTableHead sortKey="role" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Role</SortableTableHead>
                <SortableTableHead sortKey="status" currentSortKey={sortKey} currentDirection={sortDirection} onSort={handleSort}>Status</SortableTableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                if (row.kind === "user") {
                  const u = row.data;
                  const isSelf = u.id === currentUserId;
                  return (
                    <TableRow key={`u-${u.id}`}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{u.name}{isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(u.role)} className="capitalize">{u.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-700">Active</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.last_login ? formatDateTime(u.last_login) : "Never"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                                                Change Role
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {ROLES.map((r) => (
                                  <DropdownMenuItem
                                    key={r}
                                    disabled={r === u.role}
                                    onClick={() => handleRoleChange(u.id, r)}
                                  >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                    {r === u.role && " ✓"}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {!isSelf && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => setRemoveTarget(u)}
                                >
                                                                    Remove User
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                }

                const inv = row.data;
                return (
                  <TableRow key={`inv-${inv.id}`}>
                    <TableCell className="font-medium">{inv.email}</TableCell>
                    <TableCell className="text-muted-foreground italic">—</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant(inv.role)} className="capitalize">{inv.role}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      Awaiting acceptance
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleResendInvitation(inv.id)}>
                                                        Resend Invitation
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleCancelInvitation(inv.id)}
                          >
                                                        Cancel Invitation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && search && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No users match "{search}"
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Invite Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "Add User" : "Invite User"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Create a new user account directly."
                : "Send an invitation link to join your organization."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            {dialogMode === "create" && (
              <>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Password <span className="text-red-500">*</span></Label>
                  <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Min 8 characters" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!formEmail || (dialogMode === "create" && formPassword.length < 8)}
            >
              {dialogMode === "create" ? "Create User" : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{removeTarget?.name}</strong> ({removeTarget?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove}>Remove User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
