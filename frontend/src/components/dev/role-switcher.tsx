"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Role, ROLE_LABELS, ROLE_COLORS } from "@/lib/permissions";

const DEV_ORG_ID = "00000000-0000-0000-0000-000000000000";

export function RoleSwitcher() {
  const [currentRole, setCurrentRole] = useState<Role>("viewer");
  const [orgId] = useState(DEV_ORG_ID);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const handleRoleChange = (role: Role) => {
    setCurrentRole(role);
    localStorage.setItem("dev_test_role", role);
  };

  const handleOrgChange = (orgId: string) => {
    localStorage.setItem("current_org_id", orgId);
  };

  return (
    <Card className="w-80 fixed bottom-4 right-4 shadow-lg z-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Dev Role Switcher</span>
          <Badge variant="outline" className="text-xs bg-yellow-100 border-yellow-400">
            DEV ONLY
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Organization ID</Label>
          <Select value={orgId} onValueChange={handleOrgChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={DEV_ORG_ID}>Dev Organization</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Test Role</Label>
          <Select value={currentRole} onValueChange={(v) => handleRoleChange(v as Role)}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["owner", "admin", "analyst", "viewer"] as Role[]).map((role) => (
                <SelectItem key={role} value={role}>
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${ROLE_COLORS[role]}`}
                    />
                    {ROLE_LABELS[role]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-gray-500">
            Current role:{" "}
            <span className="font-medium">
              <span
                className={`inline-block w-2 h-2 rounded-full mr-1 ${ROLE_COLORS[currentRole]}`}
              />
              {ROLE_LABELS[currentRole]}
            </span>
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            const stored = localStorage.getItem("dev_test_role");
            if (stored) {
              handleRoleChange(stored as Role);
            }
          }}
        >
          Reset to Stored Role
        </Button>
      </CardContent>
    </Card>
  );
}
