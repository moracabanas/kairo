"use client"

import * as React from "react"
import { Copy, Trash2, Plus, X, ChevronDownIcon, CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Column {
  name: string
  type: string
}

interface Table {
  name: string
  columns: Column[]
}

const COMMON_TABLES: Table[] = [
  {
    name: "signals",
    columns: [
      { name: "id", type: "uuid" },
      { name: "name", type: "varchar" },
      { name: "source", type: "varchar" },
      { name: "type", type: "varchar" },
      { name: "value", type: "float8" },
      { name: "timestamp", type: "timestamptz" },
      { name: "metadata", type: "jsonb" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
  {
    name: "signal_data_points",
    columns: [
      { name: "id", type: "uuid" },
      { name: "signal_id", type: "uuid" },
      { name: "value", type: "float8" },
      { name: "quality", type: "varchar" },
      { name: "timestamp", type: "timestamptz" },
    ],
  },
  {
    name: "users",
    columns: [
      { name: "id", type: "uuid" },
      { name: "email", type: "varchar" },
      { name: "name", type: "varchar" },
      { name: "created_at", type: "timestamptz" },
    ],
  },
]

const OPERATORS = [
  { value: "=", label: "= (equals)" },
  { value: "!=", label: "!= (not equals)" },
  { value: "<", label: "< (less than)" },
  { value: ">", label: "> (greater than)" },
  { value: "<=", label: "<= (less or equal)" },
  { value: ">=", label: ">= (greater or equal)" },
  { value: "LIKE", label: "LIKE" },
  { value: "ILIKE", label: "ILIKE (case-insensitive)" },
  { value: "IN", label: "IN" },
  { value: "BETWEEN", label: "BETWEEN" },
  { value: "IS NULL", label: "IS NULL" },
  { value: "IS NOT NULL", label: "IS NOT NULL" },
]

interface WhereCondition {
  id: string
  column: string
  operator: string
  value: string
  logic: "AND" | "OR"
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function QueryBuilder() {
  const [selectedTable, setSelectedTable] = React.useState<string>("")
  const [selectedColumns, setSelectedColumns] = React.useState<Set<string>>(new Set())
  const [whereConditions, setWhereConditions] = React.useState<WhereCondition[]>([])
  const [orderByColumn, setOrderByColumn] = React.useState<string>("")
  const [orderByDirection, setOrderByDirection] = React.useState<"ASC" | "DESC">("ASC")
  const [limit, setLimit] = React.useState<string>("100")
  const [sqlOutput, setSqlOutput] = React.useState<string>("")
  const [copied, setCopied] = React.useState(false)

  const currentTable = COMMON_TABLES.find((t) => t.name === selectedTable)

  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName)
    setSelectedColumns(new Set())
    setWhereConditions([])
    setOrderByColumn("")
    setLimit("100")
    setSqlOutput("")
  }

  const toggleColumn = (columnName: string) => {
    const newColumns = new Set(selectedColumns)
    if (newColumns.has(columnName)) {
      newColumns.delete(columnName)
    } else {
      newColumns.add(columnName)
    }
    setSelectedColumns(newColumns)
  }

  const addWhereCondition = () => {
    const newCondition: WhereCondition = {
      id: generateId(),
      column: currentTable?.columns[0]?.name || "",
      operator: "=",
      value: "",
      logic: whereConditions.length === 0 ? "AND" : "AND",
    }
    setWhereConditions([...whereConditions, newCondition])
  }

  const removeWhereCondition = (id: string) => {
    setWhereConditions(whereConditions.filter((c) => c.id !== id))
  }

  const updateWhereCondition = (id: string, field: keyof WhereCondition, value: string) => {
    setWhereConditions(
      whereConditions.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    )
  }

  const buildSql = React.useCallback(() => {
    if (!selectedTable || selectedColumns.size === 0) {
      return ""
    }

    const columns = Array.from(selectedColumns)
    let query = `SELECT ${columns.join(", ")}\nFROM ${selectedTable}`

    if (whereConditions.length > 0) {
      const validConditions = whereConditions.filter((c) => {
        if (c.operator === "IS NULL" || c.operator === "IS NOT NULL") {
          return true
        }
        return c.value.trim() !== ""
      })

      if (validConditions.length > 0) {
        query += "\nWHERE "
        query += validConditions
          .map((c, idx) => {
            const condSql = buildConditionSql(c)
            if (idx === 0) return condSql
            return `${c.logic} ${condSql}`
          })
          .join(" ")
      }
    }

    if (orderByColumn) {
      query += `\nORDER BY ${orderByColumn} ${orderByDirection}`
    }

    if (limit && parseInt(limit) > 0) {
      query += `\nLIMIT ${parseInt(limit)}`
    }

    query += ";"
    return query
  }, [selectedTable, selectedColumns, whereConditions, orderByColumn, orderByDirection, limit])

  const buildConditionSql = (condition: WhereCondition): string => {
    const { column, operator, value } = condition

    if (operator === "IS NULL" || operator === "IS NOT NULL") {
      return `${column} ${operator}`
    }

    if (operator === "IN") {
      const values = value.split(",").map((v) => v.trim())
      return `${column} IN (${values.map((v) => `'${v}'`).join(", ")})`
    }

    if (operator === "BETWEEN") {
      const [val1, val2] = value.split(",").map((v) => v.trim())
      return `${column} BETWEEN '${val1}' AND '${val2}'`
    }

    if (operator === "LIKE" || operator === "ILIKE") {
      return `${column} ${operator} '${value}'`
    }

    const isNumeric = !isNaN(parseFloat(value)) && value.trim() !== ""
    if (isNumeric) {
      return `${column} ${operator} ${value}`
    }

    return `${column} ${operator} '${value}'`
  }

  React.useEffect(() => {
    setSqlOutput(buildSql())
  }, [buildSql])

  const handleCopy = async () => {
    if (sqlOutput) {
      await navigator.clipboard.writeText(sqlOutput)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClear = () => {
    setSelectedTable("")
    setSelectedColumns(new Set())
    setWhereConditions([])
    setOrderByColumn("")
    setOrderByDirection("ASC")
    setLimit("100")
    setSqlOutput("")
  }

  const isValid = selectedColumns.size > 0

  const needsValue = (operator: string) =>
    operator !== "IS NULL" && operator !== "IS NOT NULL"

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Visual Query Builder</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Label>Table</Label>
            <Select value={selectedTable} onValueChange={handleTableChange}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Available Tables</SelectLabel>
                  {COMMON_TABLES.map((table) => (
                    <SelectItem key={table.name} value={table.name}>
                      {table.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {currentTable && (
            <div className="flex flex-col gap-2">
              <Label>Columns</Label>
              <div className="flex flex-wrap gap-3 rounded-3xl border border-border bg-background p-4">
                {currentTable.columns.map((column) => (
                  <label
                    key={column.name}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedColumns.has(column.name)}
                      onChange={() => toggleColumn(column.name)}
                      className="size-4 rounded border-border accent-primary"
                    />
                    <span className="text-sm">
                      {column.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({column.type})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {currentTable && selectedColumns.size > 0 && (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>WHERE Conditions</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addWhereCondition}
                    className="gap-1"
                  >
                    <Plus className="size-3" />
                    Add Condition
                  </Button>
                </div>

                {whereConditions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No WHERE conditions added. Click &quot;Add Condition&quot; to filter results.
                  </p>
                )}

                {whereConditions.map((condition, idx) => (
                  <div key={condition.id} className="flex items-center gap-2">
                    {idx > 0 && (
                      <Select
                        value={condition.logic}
                        onValueChange={(val) =>
                          updateWhereCondition(condition.id, "logic", val as "AND" | "OR")
                        }
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <Select
                      value={condition.column}
                      onValueChange={(val) =>
                        updateWhereCondition(condition.id, "column", val)
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentTable.columns.map((col) => (
                          <SelectItem key={col.name} value={col.name}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={condition.operator}
                      onValueChange={(val) =>
                        updateWhereCondition(condition.id, "operator", val)
                      }
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {needsValue(condition.operator) && (
                      <Input
                        placeholder={
                          condition.operator === "IN"
                            ? "val1, val2, val3"
                            : condition.operator === "BETWEEN"
                            ? "val1, val2"
                            : "Enter value"
                        }
                        value={condition.value}
                        onChange={(e) =>
                          updateWhereCondition(condition.id, "value", e.target.value)
                        }
                        className="w-[200px]"
                      />
                    )}

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeWhereCondition(condition.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <Label>ORDER BY</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={orderByColumn}
                    onValueChange={setOrderByColumn}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentTable.columns.map((col) => (
                        <SelectItem key={col.name} value={col.name}>
                          {col.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={orderByDirection}
                    onValueChange={(val) =>
                      setOrderByDirection(val as "ASC" | "DESC")
                    }
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ASC">ASC</SelectItem>
                      <SelectItem value="DESC">DESC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>LIMIT</Label>
                <Input
                  type="number"
                  min="1"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-[120px]"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated SQL</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative">
            <textarea
              readOnly
              value={sqlOutput}
              placeholder="SELECT ... FROM ... WHERE ... ORDER BY ... LIMIT ...;"
              className="min-h-[150px] w-full rounded-3xl border border-border bg-background p-4 font-mono text-sm resize-y"
            />
          </div>

          {!isValid && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              Select at least one column to generate SQL
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={!sqlOutput}
              className="gap-1.5"
            >
              <Copy className="size-4" />
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={!sqlOutput}
              className="gap-1.5"
            >
              <Trash2 className="size-4" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { QueryBuilder }
