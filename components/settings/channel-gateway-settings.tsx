"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bot,
  MessageSquare,
  Zap,
  CheckCircle2,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Send,
  AlertTriangle,
  Radio,
  Clock,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { CHANNEL_GATEWAY_CONFIG } from "@/lib/data/settings-data";

export function ChannelGatewaySettings() {
  const [config, setConfig] = useState(CHANNEL_GATEWAY_CONFIG);
  const [showToken, setShowToken] = useState(false);
  const [fallbackMinutes, setFallbackMinutes] = useState(config.sms.failoverTimeoutMinutes);

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 rounded-xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-200 text-[11px] font-semibold border border-blue-400/30">
                Dual Channel Infrastructure
              </span>
              <span className="text-xs text-blue-200">PRD 26-Oct Channel Architecture</span>
            </div>
            <h2 className="text-lg font-bold tracking-tight">
              Telegram Bot Gateway & Telco SMS Fallback
            </h2>
            <p className="text-xs text-blue-100/90 leading-relaxed">
              Primary campaign communication flows through our verified Telegram Bot with one-tap <code>[OK]</code> confirmation. Recipients without active Telegram connections automatically receive SMS failover via certified corporate DND routes.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 bg-white/10 p-3 rounded-lg border border-white/15 backdrop-blur-xs">
            <div className="h-9 w-9 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Live Failover Active</div>
              <div className="text-[11px] text-blue-200">Failover Timeout: {fallbackMinutes} mins</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Telegram Bot Card */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Primary: Telegram Bot Gateway
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Official Bot for field agents and ticket holders
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[11px] font-semibold">
                Verified Bot
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-4">
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-blue-900">{config.telegram.botDisplayName}</span>
                <p className="text-[11px] text-blue-700 font-mono">{config.telegram.botUsername}</p>
              </div>
              <a
                href="https://t.me/NDCPollingUnitBot"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 hover:text-blue-900 bg-white px-2.5 py-1 rounded border border-blue-200 shadow-2xs"
              >
                <span>Open Bot</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Bot API Token */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Bot API Authentication Token</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type={showToken ? "text" : "password"}
                  value={showToken ? "bot7194098212:AAH9f2Xk8zLq0wE9P4mRt5vN1yU7oQ2mP8" : config.telegram.tokenMasked}
                  readOnly
                  className="h-8 font-mono text-xs bg-slate-50 border-slate-200"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                  className="h-8 px-2.5 text-xs text-slate-600"
                  title="Toggle token visibility"
                >
                  {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Webhook Endpoint */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Live Webhook Endpoint</Label>
                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span>Syncing OK</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Input
                  value={config.telegram.webhookUrl}
                  readOnly
                  className="h-8 font-mono text-xs bg-slate-50 border-slate-200"
                />
                <Button
                  disabled
                  title="Not available yet"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2.5 text-xs text-slate-500 border-slate-200 font-medium shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  <span>Ping Webhook: Not available yet</span>
                </Button>
              </div>
            </div>

            {/* Metrics Footer */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Connected Personnel</span>
                <span className="text-sm font-bold text-slate-900">{config.telegram.connectedAgentsCount} Verified</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Number Matching</span>
                <span className="text-sm font-bold text-slate-900">Telegram Contact Hash</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telco SMS Fallback Card */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Secondary: Telco SMS Fallback Gateway
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Direct corporate priority delivery override (DND bypass)
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-semibold">
                DND Override Active
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-2 space-y-4">
            {/* Sender ID & Balance Banner */}
            <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/80 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">Sender ID:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-amber-300">
                    {config.sms.senderId}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 font-medium">
                  Approved on MTN, Airtel, Glo, 9mobile
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 block">Available Balance</span>
                <span className="text-xs font-bold text-slate-900">{config.sms.balanceNaira}</span>
              </div>
            </div>

            {/* Failover Timeout Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Telegram Bot $\to$ SMS Failover Timeout
                </Label>
                <span className="text-[11px] font-bold text-amber-700">
                  {fallbackMinutes} Minutes
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[1, 3, 5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFallbackMinutes(mins)}
                    className={`py-1.5 text-xs font-medium rounded border transition-colors ${
                      fallbackMinutes === mins
                        ? "bg-slate-900 text-white border-slate-900 font-bold"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">
                If recipient bot does not acknowledge delivery within {fallbackMinutes}m, system dispatches SMS automatically.
              </p>
            </div>

            {/* Test SMS Simulator */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs font-semibold text-slate-700">Test SMS Delivery</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  disabled
                  className="h-8 text-xs bg-slate-50 border-slate-200"
                />
                <Button
                  disabled
                  title="Not available yet"
                  size="sm"
                  className="h-8 text-xs font-medium shrink-0"
                >
                  <Send className="h-3.5 w-3.5 mr-1" />
                  <span>Not available yet</span>
                </Button>
              </div>
            </div>

            {/* SMS Provider Note */}
            <div className="p-2.5 rounded bg-slate-50 border border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span><strong>Gateway Provider:</strong> {config.sms.provider}</span>
              <span className="font-mono text-emerald-700 font-semibold">Latency 1.2s</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meta WhatsApp Policy Note */}
      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-800">
            Why Telegram + Telco SMS instead of WhatsApp Business API?
          </p>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Per PRD 26-Oct decisions, Meta's global WhatsApp Business Messaging Policy strictly prohibits political parties, candidates, campaigns, and political consulting providers. The NDC architecture uses Telegram Bot for interactive message confirmation (OK buttons) backed by corporate Telco SMS routes.
          </p>
        </div>
      </div>
    </div>
  );
}
