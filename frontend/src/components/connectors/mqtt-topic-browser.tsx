"use client"

import * as React from "react"
import {
  Wifi,
  WifiOff,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  X,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TopicNode {
  name: string
  children: TopicNode[]
  expanded?: boolean
}

interface Subscription {
  id: string
  topic: string
  qos: 0 | 1 | 2
  messages: MockMessage[]
}

interface MockMessage {
  id: string
  payload: string
  timestamp: Date
}

const MOCK_TOPICS: TopicNode[] = [
  {
    name: "sensors",
    expanded: true,
    children: [
      {
        name: "temperature",
        children: [
          { name: "living-room", children: [] },
          { name: "bedroom", children: [] },
          { name: "kitchen", children: [] },
        ],
      },
      {
        name: "humidity",
        children: [
          { name: "living-room", children: [] },
          { name: "bedroom", children: [] },
        ],
      },
      {
        name: "pressure",
        children: [],
      },
    ],
  },
  {
    name: "actuators",
    children: [
      {
        name: "lights",
        children: [
          { name: "living-room", children: [] },
          { name: "bedroom", children: [] },
        ],
      },
      {
        name: "thermostat",
        children: [],
      },
    ],
  },
  {
    name: "system",
    children: [
      { name: "status", children: [] },
      { name: "logs", children: [] },
      { name: "config", children: [] },
    ],
  },
]

const generateMockMessage = (topic: string): MockMessage => {
  const payloads = [
    '{"value": 22.5, "unit": "celsius"}',
    '{"value": 45.2, "unit": "percent"}',
    '{"value": 1013.25, "unit": "hPa"}',
    '{"state": "on", "brightness": 75}',
    '{"state": "off"}',
    '{"temperature": 23.1, "target": 22.0}',
    '{"status": "online", "uptime": 3600}',
    '{"level": "info", "message": "System running normally"}',
  ]
  return {
    id: Math.random().toString(36).substring(2, 9),
    payload: payloads[Math.floor(Math.random() * payloads.length)],
    timestamp: new Date(),
  }
}

const filterTopics = (nodes: TopicNode[], filter: string): TopicNode[] => {
  if (!filter) return nodes

  const matchesFilter = (name: string): boolean => {
    if (filter === "#") return true
    if (filter === "+") return true
    return name.toLowerCase().includes(filter.toLowerCase())
  }

  const matchesWildcard = (pattern: string, name: string): boolean => {
    if (pattern === "#") return true
    if (pattern === "+") return true
    const patternParts = pattern.split("/")
    const nameParts = name.split("/")
    return patternParts.every((part, i) => part === "#" || part === "+" || part === nameParts[i])
  }

  const result: TopicNode[] = []
  for (const node of nodes) {
    const matchingChildren = filterTopics(node.children, filter)
    if (
      matchesFilter(node.name) ||
      matchesWildcard(filter, node.name) ||
      matchingChildren.length > 0
    ) {
      result.push({
        ...node,
        children: matchingChildren,
        expanded: true,
      })
    }
  }
  return result
}

const getAllTopics = (nodes: TopicNode[], prefix = ""): string[] => {
  const topics: string[] = []
  for (const node of nodes) {
    const fullTopic = prefix ? `${prefix}/${node.name}` : node.name
    if (node.children.length === 0) {
      topics.push(fullTopic)
    } else {
      topics.push(...getAllTopics(node.children, fullTopic))
    }
  }
  return topics
}

function MqttTopicBrowser() {
  const [brokerUrl, setBrokerUrl] = React.useState("ws://localhost:1884")
  const [isConnected, setIsConnected] = React.useState(false)
  const [connecting, setConnecting] = React.useState(false)
  const [topicFilter, setTopicFilter] = React.useState("")
  const [subscriptions, setSubscriptions] = React.useState<Subscription[]>([])
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set(["sensors"]))
  const [messageCount, setMessageCount] = React.useState(5)

  const filteredTopics = React.useMemo(() => {
    if (!topicFilter || topicFilter === "#" || topicFilter === "+") {
      return MOCK_TOPICS
    }
    return filterTopics(MOCK_TOPICS, topicFilter)
  }, [topicFilter])

  const availableTopics = React.useMemo(() => {
    return getAllTopics(filteredTopics)
  }, [filteredTopics])

  const toggleNode = (path: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleConnect = async () => {
    setConnecting(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsConnected(true)
    setConnecting(false)
  }

  const handleDisconnect = () => {
    setIsConnected(false)
  }

  const handleSubscribe = (topic: string, qos: 0 | 1 | 2 = 0) => {
    if (subscriptions.some((s) => s.topic === topic)) return

    const newSubscription: Subscription = {
      id: Math.random().toString(36).substring(2, 9),
      topic,
      qos,
      messages: [],
    }
    setSubscriptions([...subscriptions, newSubscription])
  }

  const handleUnsubscribe = (id: string) => {
    setSubscriptions(subscriptions.filter((s) => s.id !== id))
  }

  const handleQosChange = (id: string, qos: 0 | 1 | 2) => {
    setSubscriptions(
      subscriptions.map((s) => (s.id === id ? { ...s, qos } : s))
    )
  }

  React.useEffect(() => {
    if (!isConnected) return

    const intervals = subscriptions.map((sub) => {
      return setInterval(() => {
        const newMessage = generateMockMessage(sub.topic)
        setSubscriptions((prev) =>
          prev.map((s) => {
            if (s.id === sub.id) {
              const updatedMessages = [newMessage, ...s.messages].slice(0, messageCount)
              return { ...s, messages: updatedMessages }
            }
            return s
          })
        )
      }, 2000 + Math.random() * 3000)
    })

    return () => {
      intervals.forEach(clearInterval)
    }
  }, [isConnected, subscriptions, messageCount])

  const renderTopicTree = (nodes: TopicNode[], path = "") => {
    return nodes.map((node) => {
      const fullPath = path ? `${path}/${node.name}` : node.name
      const isExpanded = expandedNodes.has(fullPath)
      const hasChildren = node.children.length > 0
      const isLeaf = !hasChildren

      return (
        <div key={fullPath} className="select-none">
          <div
            className={`flex items-center gap-1 py-1 px-2 rounded-xl hover:bg-muted cursor-pointer ${
              isLeaf ? "ml-5" : ""
            }`}
            onClick={() => (hasChildren ? toggleNode(fullPath) : null)}
          >
            {hasChildren && (
              <span className="size-4 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </span>
            )}
            {!hasChildren && <span className="size-4" />}
            <span className="text-sm font-mono">{node.name}</span>
          </div>
          {isExpanded && hasChildren && (
            <div className="ml-4">{renderTopicTree(node.children, fullPath)}</div>
          )}
          {isExpanded && isLeaf && (
            <div className="ml-8 py-1 flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSubscribe(fullPath, 0)}
                disabled={subscriptions.some((s) => s.topic === fullPath)}
                className="gap-1 h-7"
              >
                <Plus className="size-3" />
                Subscribe
              </Button>
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="flex gap-6 h-[600px]">
      <Card className="flex-1 min-w-0 flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <span>MQTT Topic Browser</span>
            <Badge variant={isConnected ? "default" : "outline"} className="gap-1.5">
              {isConnected ? (
                <>
                  <Wifi className="size-3" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="size-3" />
                  Disconnected
                </>
              )}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="flex flex-col gap-2">
            <Label htmlFor="broker-url">Broker URL</Label>
            <div className="flex gap-2">
              <Input
                id="broker-url"
                value={brokerUrl}
                onChange={(e) => setBrokerUrl(e.target.value)}
                placeholder="ws://localhost:1884"
                className="font-mono text-sm"
              />
              {isConnected ? (
                <Button variant="outline" onClick={handleDisconnect} className="gap-1.5">
                  <WifiOff className="size-4" />
                  Disconnect
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={connecting} className="gap-1.5">
                  <Wifi className="size-4" />
                  {connecting ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            <Label htmlFor="topic-filter">Topic Filter</Label>
            <Input
              id="topic-filter"
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              placeholder="Filter topics (use # for all, + for single level)"
              className="font-mono text-sm"
            />
          </div>

          <div className="flex flex-col gap-2 flex-1 overflow-hidden">
            <Label>Available Topics</Label>
            <div className="flex-1 overflow-auto rounded-3xl border border-border bg-muted/30 p-3">
              {renderTopicTree(filteredTopics)}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 min-w-0 flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <span>Subscriptions</span>
            <Badge variant="secondary">{subscriptions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 flex-1 overflow-hidden">
          {subscriptions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              No subscriptions. Click Subscribe on a topic to begin.
            </div>
          ) : (
            <div className="flex flex-col gap-4 flex-1 overflow-auto">
              {subscriptions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-col gap-2 rounded-3xl border border-border p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-mono truncate">{sub.topic}</span>
                      <Badge variant="outline" className="text-xs">
                        QoS {sub.qos}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Select
                        value={String(sub.qos)}
                        onValueChange={(val) =>
                          handleQosChange(sub.id, Number(val) as 0 | 1 | 2)
                        }
                      >
                        <SelectTrigger className="w-[80px] h-7">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel>QoS</SelectLabel>
                            <SelectItem value="0">QoS 0</SelectItem>
                            <SelectItem value="1">QoS 1</SelectItem>
                            <SelectItem value="2">QoS 2</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleUnsubscribe(sub.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="size-3" />
                      <span>Last {sub.messages.length} messages</span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-[150px] overflow-auto rounded-2xl bg-muted/50 p-2">
                      {sub.messages.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic px-2 py-1">
                          Waiting for messages...
                        </span>
                      ) : (
                        sub.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className="flex items-start gap-2 px-2 py-1 rounded-lg hover:bg-background/80"
                          >
                            <span className="text-xs text-muted-foreground shrink-0">
                              {msg.timestamp.toLocaleTimeString()}
                            </span>
                            <span className="text-xs font-mono break-all">
                              {msg.payload}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {subscriptions.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Label htmlFor="message-count" className="text-sm shrink-0">
                Preview messages:
              </Label>
              <Select
                value={String(messageCount)}
                onValueChange={(val) => setMessageCount(Number(val))}
              >
                <SelectTrigger id="message-count" className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="3">3 messages</SelectItem>
                    <SelectItem value="5">5 messages</SelectItem>
                    <SelectItem value="10">10 messages</SelectItem>
                    <SelectItem value="20">20 messages</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { MqttTopicBrowser }
