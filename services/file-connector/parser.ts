export interface SignalDataPoint {
  timestamp: Date;
  value: number;
  metadata?: Record<string, unknown>;
}

export class CsvParser {
  parse(fileContent: string): SignalDataPoint[] {
    const lines = fileContent.trim().split('\n');
    if (lines.length === 0) {
      return [];
    }

    const result: SignalDataPoint[] = [];
    let startIndex = 0;

    const firstLine = lines[0].trim();
    const hasHeader = isNaN(Date.parse(firstLine.split(',')[0])) &&
                      isNaN(parseFloat(firstLine.split(',')[1]));

    if (hasHeader) {
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 2) continue;

      const timestamp = new Date(parts[0].trim());
      const value = parseFloat(parts[1].trim());

      if (isNaN(timestamp.getTime()) || isNaN(value)) {
        continue;
      }

      let metadata: Record<string, unknown> | undefined;
      if (parts.length > 2) {
        const metadataStr = parts.slice(2).join(',').trim();
        if (metadataStr) {
          try {
            metadata = JSON.parse(metadataStr);
          } catch {
            metadata = { raw: metadataStr };
          }
        }
      }

      result.push({ timestamp, value, metadata });
    }

    return result;
  }
}

export class JsonParser {
  parse(fileContent: string): SignalDataPoint[] {
    const parsed = JSON.parse(fileContent);

    if (!Array.isArray(parsed)) {
      throw new Error('JSON must be an array of data points');
    }

    const result: SignalDataPoint[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const timestamp = item.timestamp ? new Date(item.timestamp) : null;
      const value = typeof item.value === 'number' ? item.value : parseFloat(item.value);

      if (!timestamp || isNaN(timestamp.getTime())) {
        continue;
      }
      if (isNaN(value)) {
        continue;
      }

      const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : undefined;

      result.push({
        timestamp,
        value,
        metadata: metadata as Record<string, unknown> | undefined,
      });
    }

    return result;
  }
}
