export type Dependency = {
  url: string;
  name?: string;
  esm?: boolean;
};

export type Case = {
  id: string;
  name?: string;
  code: string;
  esm?: boolean;
  dependencies?: Dependency[];
};

export type TestState = {
  status: "idle" | "running" | "success" | "error";
  error?: Error | null;
  result?: {
    opsPerSecond: number;
    averageTime: number;
    averageTimeFormatted: string;
  };
};
