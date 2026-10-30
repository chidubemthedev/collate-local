"use client";

import React, { useState } from "react";
import { AccessGroup } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  Send,
  Eye,
  Filter,
  LogIn,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

interface AccessGroupsManagerProps {
  customGroups: AccessGroup[];
  onCreateGroup: () => void;
  onEditGroup: (group: AccessGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onCloneGroup: (group: AccessGroup) => void;
}

export function AccessGroupsManager({
  customGroups,
  onCreateGroup,
  onEditGroup,
  onDeleteGroup,
  onCloneGroup,
}: AccessGroupsManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredGroups = customGroups.filter((g) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      g.name.toLowerCase().includes(query) ||
      (g.description && g.description.toLowerCase().includes(query)) ||
      (g.membersDescription && g.membersDescription.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Banner and Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>Custom Access Groups</span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-semibold">
              {customGroups.length} Active
            </Badge>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin-defined campaign directorates, legal units, and specialized field teams governed by tree permissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-56">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search custom groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>
          <Button
            onClick={onCreateGroup}
            size="sm"
            className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Custom Group</span>
          </Button>
        </div>
      </div>

      {/* Custom Groups Grid */}
      {filteredGroups.length === 0 ? (
        <Card className="border-dashed border-slate-300 bg-slate-50">
          <CardContent className="p-8 text-center space-y-3">
            <div className="h-10 w-10 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">No Custom Groups Found</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {searchQuery
                  ? "No custom groups match your search query."
                  : "Create custom groups to grant specialized subtree access to field teams."}
              </p>
            </div>
            <Button
              onClick={onCreateGroup}
              size="sm"
              variant="outline"
              className="text-xs font-medium"
            >
              + Create First Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map((group) => {
            return (
              <Card
                key={group.id}
                className="border-slate-200 hover:border-slate-300 shadow-xs transition-all flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-sm font-bold text-slate-900 leading-tight">
                        {group.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500 line-clamp-2">
                        {group.description || "No description provided."}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-semibold shrink-0"
                    >
                      {group.membersCount || 0} Members
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium flex items-center gap-1.5 pt-1">
                    <Users className="h-3 w-3 text-slate-400" />
                    <span>{group.membersDescription || "Assigned Personnel"}</span>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-2.5">
                  <div className="p-2.5 rounded-md bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <Send className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-700">Messages: </span>
                        <span className="text-slate-600">{group.canMessage}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Filter className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-700">Filters: </span>
                        <span className="text-slate-600">{group.canFilterBy}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-700">Coverage: </span>
                        <span className="text-slate-600">{group.seesCoverageFor}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <LogIn className="h-3.5 w-3.5 text-slate-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-700">Login: </span>
                        <span className="text-slate-600">{group.logsIn}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">Created: {group.createdAt}</span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCloneGroup(group)}
                        className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900 gap-1"
                        title="Clone as new group"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Clone</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditGroup(group)}
                        className="h-7 px-2 text-[11px] text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 gap-1"
                      >
                        <Edit2 className="h-3 w-3" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteGroup(group.id)}
                        className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
