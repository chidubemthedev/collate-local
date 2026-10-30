"use client";

import React, { useState } from "react";
import { AccessGroup } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Shield,
  Users,
  Send,
  Filter,
  Eye,
  LogIn,
  Edit2,
  Lock,
  Plus,
  Sparkles,
} from "lucide-react";

interface AccessMatrixTableProps {
  groups: AccessGroup[];
  onEditGroup?: (group: AccessGroup) => void;
  onCreateGroup?: () => void;
}

export function AccessMatrixTable({
  groups,
  onEditGroup,
  onCreateGroup,
}: AccessMatrixTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tabFilter, setTabFilter] = useState<"all" | "system" | "custom">("all");

  const filteredGroups = groups.filter((g) => {
    // Tab filter
    if (tabFilter === "system" && !g.isSystem) return false;
    if (tabFilter === "custom" && g.isSystem) return false;

    // Search query
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      g.name.toLowerCase().includes(query) ||
      (g.description && g.description.toLowerCase().includes(query)) ||
      (g.membersDescription && g.membersDescription.toLowerCase().includes(query)) ||
      g.canMessage.toLowerCase().includes(query) ||
      g.canFilterBy.toLowerCase().includes(query) ||
      g.seesCoverageFor.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-slate-100 p-0.5 border border-slate-200">
            <button
              onClick={() => setTabFilter("all")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                tabFilter === "all"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All Roles ({groups.length})
            </button>
            <button
              onClick={() => setTabFilter("system")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                tabFilter === "system"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              System Defaults (4)
            </button>
            <button
              onClick={() => setTabFilter("custom")}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                tabFilter === "custom"
                  ? "bg-white text-slate-900 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Custom Groups ({groups.filter((g) => !g.isSystem).length})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search permissions & roles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
            />
          </div>

          {onCreateGroup && (
            <Button
              onClick={onCreateGroup}
              size="sm"
              className="h-8 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Group</span>
            </Button>
          )}
        </div>
      </div>

      {/* Permissions Matrix Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow>
                <TableHead className="w-[220px] text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-slate-500" />
                    <span>Role / Access Group</span>
                  </div>
                </TableHead>
                <TableHead className="w-[200px] text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    <span>Who / Members</span>
                  </div>
                </TableHead>
                <TableHead className="w-[220px] text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-slate-500" />
                    <span>Can Message</span>
                  </div>
                </TableHead>
                <TableHead className="w-[190px] text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    <span>Can Filter By</span>
                  </div>
                </TableHead>
                <TableHead className="w-[170px] text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                    <span>Sees Coverage For</span>
                  </div>
                </TableHead>
                <TableHead className="w-[160px] text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <LogIn className="h-3.5 w-3.5 text-slate-500" />
                    <span>Login Type</span>
                  </div>
                </TableHead>
                <TableHead className="w-[80px] text-right text-xs font-semibold text-slate-700">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                    No access groups found matching your search.
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => {
                  return (
                    <TableRow key={group.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Role / Group Name */}
                      <TableCell className="align-top py-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{group.name}</span>
                            {group.isSystem ? (
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] px-1 py-0 font-medium"
                              >
                                Core
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] px-1 py-0 font-medium"
                              >
                                Custom
                              </Badge>
                            )}
                          </div>
                          {group.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {group.description}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Who / Members */}
                      <TableCell className="align-top py-3">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-800 font-medium">
                            {group.membersDescription || "Designated Users"}
                          </span>
                          {group.membersCount !== undefined && (
                            <p className="text-[11px] text-slate-500">
                              {group.membersCount.toLocaleString()} personnel
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Can Message */}
                      <TableCell className="align-top py-3">
                        <div className="flex items-start gap-1.5">
                          <div
                            className={`p-1 rounded mt-0.5 shrink-0 ${
                              group.canMessage.includes("No one")
                                ? "bg-slate-100 text-slate-400"
                                : group.canMessage.includes("Everyone")
                                ? "bg-purple-100 text-purple-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            <Send className="h-3 w-3" />
                          </div>
                          <span
                            className={`text-xs font-medium ${
                              group.canMessage.includes("No one")
                                ? "text-slate-500 italic"
                                : "text-slate-800"
                            }`}
                          >
                            {group.canMessage}
                          </span>
                        </div>
                      </TableCell>

                      {/* Can Filter By */}
                      <TableCell className="align-top py-3">
                        <div className="text-xs text-slate-700">
                          {group.canFilterBy === "—" ? (
                            <span className="text-slate-400 italic">None</span>
                          ) : (
                            <span className="font-medium text-slate-800">{group.canFilterBy}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Sees Coverage For */}
                      <TableCell className="align-top py-3">
                        <div className="text-xs">
                          {group.seesCoverageFor === "—" ? (
                            <span className="text-slate-400 italic">No access</span>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-medium px-1.5 py-0.5 ${
                                group.seesCoverageFor.includes("National")
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              {group.seesCoverageFor}
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      {/* Login Type */}
                      <TableCell className="align-top py-3">
                        <div className="space-y-0.5">
                          <span className="text-xs font-medium text-slate-800 flex items-center gap-1">
                            {group.logsIn.includes("Telegram") ? (
                              <span className="text-blue-600 font-semibold">{group.logsIn}</span>
                            ) : group.logsIn.includes("Token") ? (
                              <span className="text-amber-700 font-semibold">{group.logsIn}</span>
                            ) : (
                              <span className="text-slate-900">{group.logsIn}</span>
                            )}
                          </span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="align-top py-3 text-right">
                        {group.isSystem ? (
                          <div className="flex items-center justify-end text-slate-400" title="System role rules cannot be edited">
                            <Lock className="h-3.5 w-3.5" />
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditGroup && onEditGroup(group)}
                            className="h-7 w-7 p-0 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title="Edit Custom Group"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footnote on Inverted Tree Governance */}
        <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              <strong>Inverted Tree Engine:</strong> A user at office level $X$ sees and broadcasts only to overlapping geographic subtrees.
            </span>
          </div>
          <span className="hidden md:inline font-mono text-[10px] text-slate-400">
            PRD 28-Oct Rule: Any Overlap Computes Subtree
          </span>
        </div>
      </div>
    </div>
  );
}
