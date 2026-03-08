import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSession } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Download, Plus, Shield, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface YaraString {
  id: string;
  identifier: string;
  type: "text" | "hex" | "regex";
  value: string;
  modifiers: {
    ascii: boolean;
    wide: boolean;
    nocase: boolean;
    fullword: boolean;
  };
}

let stringCounter = 0;

function createString(): YaraString {
  const idx = stringCounter++;
  return {
    id: `str-${idx}`,
    identifier: `$s${idx}`,
    type: "text",
    value: "",
    modifiers: { ascii: false, wide: false, nocase: false, fullword: false },
  };
}

function buildYaraRule(
  ruleName: string,
  author: string,
  description: string,
  tags: string,
  strings: YaraString[],
  condition: string,
): string {
  const cleanName = ruleName.replace(/[^a-zA-Z0-9_]/g, "_") || "unnamed_rule";
  const tagStr = tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .join(" ");

  let rule = `rule ${cleanName}`;
  if (tagStr) rule += ` : ${tagStr}`;
  rule += " {\n";
  rule += "  meta:\n";
  if (author) rule += `    author = "${author}"\n`;
  if (description) rule += `    description = "${description}"\n`;
  rule += `    date = "${new Date().toISOString().split("T")[0]}"\n`;

  if (strings.some((s) => s.value.trim())) {
    rule += "  strings:\n";
    for (const s of strings) {
      if (!s.value.trim()) continue;
      const mods: string[] = [];
      if (s.modifiers.ascii) mods.push("ascii");
      if (s.modifiers.wide) mods.push("wide");
      if (s.modifiers.nocase) mods.push("nocase");
      if (s.modifiers.fullword) mods.push("fullword");
      const modStr = mods.length ? ` ${mods.join(" ")}` : "";
      if (s.type === "text") {
        rule += `    ${s.identifier} = "${s.value}"${modStr}\n`;
      } else if (s.type === "hex") {
        rule += `    ${s.identifier} = { ${s.value} }${modStr}\n`;
      } else {
        rule += `    ${s.identifier} = /${s.value}/${modStr}\n`;
      }
    }
  }

  rule += "  condition:\n";
  rule += `    ${condition || "true"}\n`;
  rule += "}";
  return rule;
}

export function YaraRuleBuilder() {
  const [ruleName, setRuleName] = useState("detect_malware");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [strings, setStrings] = useState<YaraString[]>([createString()]);
  const [condition, setCondition] = useState("any of them");
  const createSession = useCreateSession();

  const ruleText = buildYaraRule(
    ruleName,
    author,
    description,
    tags,
    strings,
    condition,
  );

  const addString = useCallback(() => {
    setStrings((prev) => [...prev, createString()]);
  }, []);

  const removeString = useCallback((id: string) => {
    setStrings((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const updateString = useCallback((id: string, patch: Partial<YaraString>) => {
    setStrings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const toggleModifier = useCallback(
    (id: string, mod: keyof YaraString["modifiers"]) => {
      setStrings((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, modifiers: { ...s.modifiers, [mod]: !s.modifiers[mod] } }
            : s,
        ),
      );
    },
    [],
  );

  const insertCondition = (snippet: string) => {
    setCondition(snippet);
  };

  const handleExport = () => {
    const blob = new Blob([ruleText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ruleName.replace(/[^a-zA-Z0-9_]/g, "_") || "rule"}.yar`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported .yar file");
  };

  const handleSaveSession = async () => {
    const validStrings = strings.filter((s) => s.value.trim()).length;
    try {
      await createSession.mutateAsync({
        filename: `${ruleName.replace(/[^a-zA-Z0-9_]/g, "_") || "rule"}.yar`,
        tool: "YARA Rule Builder",
        resultSummary: `${validStrings} string${validStrings !== 1 ? "s" : ""}, condition: ${condition.slice(0, 40)}`,
      });
      toast.success("Session saved");
    } catch {
      toast.error("Failed to save session");
    }
  };

  const quickConditions = [
    "any of them",
    "all of them",
    "filesize < 1MB",
    "uint16(0) == 0x5A4D",
    "uint32(0) == 0x7F454C46",
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold text-terminal-green tracking-tight">
          $ yara-rule-builder
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          Build YARA detection rules with live preview
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Builder */}
        <div className="space-y-4">
          {/* Rule metadata */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Rule Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Rule Name
                </Label>
                <Input
                  data-ocid="yara.rule_name.input"
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="detect_malware"
                  className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 h-8"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                    Author
                  </Label>
                  <Input
                    data-ocid="yara.author.input"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="analyst"
                    className="font-mono text-xs bg-terminal-bg border-border text-foreground placeholder:text-muted-foreground/40 h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                    Tags
                  </Label>
                  <Input
                    data-ocid="yara.tags.input"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="malware, trojan"
                    className="font-mono text-xs bg-terminal-bg border-border text-foreground placeholder:text-muted-foreground/40 h-8"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                  Description
                </Label>
                <Input
                  data-ocid="yara.description.input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detects..."
                  className="font-mono text-xs bg-terminal-bg border-border text-foreground placeholder:text-muted-foreground/40 h-8"
                />
              </div>
            </CardContent>
          </Card>

          {/* Strings */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-mono text-sm text-terminal-cyan">
                  Strings
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  data-ocid="yara.add_string.button"
                  onClick={addString}
                  className="font-mono text-xs border-terminal-green/40 text-terminal-green hover:bg-terminal-green/10 h-7 gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add String
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {strings.length === 0 ? (
                <p className="font-mono text-xs text-muted-foreground/50 text-center py-4">
                  No strings defined
                </p>
              ) : (
                strings.map((s, idx) => (
                  <div
                    key={s.id}
                    data-ocid={`yara.string_entry.item.${idx + 1}`}
                    className="border border-border/60 rounded p-3 space-y-2 bg-terminal-bg/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-terminal-amber w-8 shrink-0">
                        {s.identifier}
                      </span>
                      <Select
                        value={s.type}
                        onValueChange={(v) =>
                          updateString(s.id, { type: v as YaraString["type"] })
                        }
                      >
                        <SelectTrigger className="h-7 font-mono text-xs bg-terminal-bg border-border w-24 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="font-mono text-xs bg-card border-border">
                          <SelectItem value="text">text</SelectItem>
                          <SelectItem value="hex">hex</SelectItem>
                          <SelectItem value="regex">regex</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={s.value}
                        onChange={(e) =>
                          updateString(s.id, { value: e.target.value })
                        }
                        placeholder={
                          s.type === "text"
                            ? "suspicious string"
                            : s.type === "hex"
                              ? "4D 5A 90 00"
                              : "pattern.*regex"
                        }
                        className="h-7 font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 flex-1"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        data-ocid={`yara.remove_string.delete_button.${idx + 1}`}
                        onClick={() => removeString(s.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 pl-10">
                      {(["ascii", "wide", "nocase", "fullword"] as const).map(
                        (mod) => {
                          const checkId = `${s.id}-${mod}`;
                          return (
                            <div
                              key={mod}
                              className="flex items-center gap-1.5 cursor-pointer"
                            >
                              <Checkbox
                                id={checkId}
                                checked={s.modifiers[mod]}
                                onCheckedChange={() =>
                                  toggleModifier(s.id, mod)
                                }
                                className="w-3 h-3 border-border data-[state=checked]:bg-terminal-green data-[state=checked]:border-terminal-green"
                              />
                              <Label
                                htmlFor={checkId}
                                className="font-mono text-xs text-muted-foreground cursor-pointer"
                              >
                                {mod}
                              </Label>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Condition */}
          <Card className="border-border bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-mono text-sm text-terminal-cyan">
                Condition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {quickConditions.map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => insertCondition(q)}
                    className={cn(
                      "font-mono text-xs px-2 py-1 rounded border transition-colors",
                      condition === q
                        ? "border-terminal-green/60 bg-terminal-green/10 text-terminal-green"
                        : "border-border text-muted-foreground hover:border-terminal-green/40 hover:text-terminal-green",
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <Textarea
                data-ocid="yara.condition.textarea"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="any of them"
                className="font-mono text-xs bg-terminal-bg border-border text-terminal-green placeholder:text-muted-foreground/40 resize-none h-20"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              data-ocid="yara.export.button"
              onClick={handleExport}
              className="font-mono text-xs border-terminal-cyan/40 text-terminal-cyan hover:bg-terminal-cyan/10 gap-1.5"
            >
              <Download className="w-3 h-3" />
              Export .yar
            </Button>
            <Button
              variant="outline"
              data-ocid="yara.save_session.button"
              onClick={handleSaveSession}
              disabled={createSession.isPending}
              className="font-mono text-xs border-terminal-green/40 text-terminal-green hover:bg-terminal-green/10 gap-1.5"
            >
              {createSession.isPending ? "Saving..." : "Save Session"}
            </Button>
          </div>
        </div>

        {/* Right: Live preview */}
        <div className="space-y-4">
          <Card className="border-border bg-card/60 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-mono text-sm text-terminal-cyan">
                  Live Preview
                </CardTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-xs border-terminal-green/40 text-terminal-green"
                >
                  {strings.filter((s) => s.value.trim()).length} strings
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded border border-border bg-terminal-bg p-4 overflow-auto max-h-[600px]">
                <pre className="font-mono text-xs text-terminal-green whitespace-pre leading-relaxed">
                  {ruleText}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
