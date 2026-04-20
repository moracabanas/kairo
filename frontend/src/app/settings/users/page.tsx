"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
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
import { UserPlus, Trash2, Shield, Loader2 } from "lucide-react";
import { OrgUser, listOrgUsers, inviteUser, updateUserRole, removeUser, getUserOrgId } from "@/lib/supabase";

const ROLE_COLORS = {
  owner: "bg-purple-100 text-purple-800 border-purple-200",
  admin: "bg-red-100 text-red-800 border-red-200",
  analyst: "bg-blue-100 text-blue-800 border-blue-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "analyst", label: "Analyst" },
  { value: "viewer", label: "Viewer" },
];

interface InviteFormData {
  email: string;
  role: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({ email: "", role: "viewer" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [removeConfirmUser, setRemoveConfirmUser] = useState<OrgUser | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const [roleChangeUser, setRoleChangeUser] = useState<{ id: string; role: string } | null>(null);
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
        if (session?.user) {
          setCurrentUserId(session.user.id);
          const userOrgId = await getUserOrgId(session.user.id);
          if (userOrgId) {
            setOrgId(userOrgId);
            const data = await listOrgUsers(userOrgId);
            setUsers(data);
          } else {
            setError("No organization found for user");
          }
        } else {
          setError("Not authenticated");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      await inviteUser(orgId, inviteForm.email, inviteForm.role);
      const data = await listOrgUsers(orgId);
      setUsers(data);
      setInviteOpen(false);
      setInviteForm({ email: "", role: "viewer" });
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!orgId) return;
    setRoleChangeLoading(true);
    try {
      await updateUserRole(userId, newRole);
      const data = await listOrgUsers(orgId);
      setUsers(data);
      setRoleChangeUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!orgId) return;
    setRemoveLoading(true);
    try {
      await removeUser(userId);
      const data = await listOrgUsers(orgId);
      setUsers(data);
      setRemoveConfirmUser(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove user");
    } finally {
      setRemoveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization users and their roles
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              {inviteError && (
                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                  {inviteError}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-medium">
                  Role
                </label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value) =>
                    setInviteForm({ ...inviteForm, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteLoading}>
                  {inviteLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Send Invite"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Organization Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    {user.id === currentUserId ? (
                      <Badge className={ROLE_COLORS[user.role]}>
                        {user.role}
                      </Badge>
                    ) : roleChangeUser?.id === user.id ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={roleChangeUser.role}
                          onValueChange={(value) =>
                            handleRoleChange(user.id, value)
                          }
                          disabled={roleChangeLoading}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRoleChangeUser(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge className={ROLE_COLORS[user.role]}>
                          {user.role}
                        </Badge>
                        {user.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setRoleChangeUser({ id: user.id, role: user.role })
                            }
                          >
                            Change
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== "owner" && user.id !== currentUserId && (
                      <Dialog
                        open={removeConfirmUser?.id === user.id}
                        onOpenChange={(open) =>
                          setRemoveConfirmUser(open ? user : null)
                        }
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setRemoveConfirmUser(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Remove User</DialogTitle>
                          </DialogHeader>
                          <p className="text-muted-foreground">
                            Are you sure you want to remove{" "}
                            <strong>{removeConfirmUser?.email}</strong> from
                            the organization? This action cannot be undone.
                          </p>
                          <div className="flex justify-end gap-2 mt-4">
                            <Button
                              variant="outline"
                              onClick={() => setRemoveConfirmUser(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() =>
                                handleRemoveUser(removeConfirmUser!.id)
                              }
                              disabled={removeLoading}
                            >
                              {removeLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                "Remove User"
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No users found. Invite your first team member.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}