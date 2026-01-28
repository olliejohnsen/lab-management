import { randomBytes } from "crypto";

/**
 * Extract environment variable names referenced in docker-compose content.
 * Matches ${VAR}, ${VAR:-default}, and $VAR.
 */
function extractEnvVarNames(composeContent: string): Set<string> {
  const names = new Set<string>();
  // ${VAR} or ${VAR:-default} or ${VAR-default}
  const braced = composeContent.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-?[^}]*)?\}/g);
  for (const m of braced) {
    names.add(m[1]);
  }
  // $VAR (word boundary, not $$)
  const unbraced = composeContent.matchAll(/(?<!\$)\$([A-Za-z_][A-Za-z0-9_]*)(?=\s|$|[^a-zA-Z0-9_])/g);
  for (const m of unbraced) {
    names.add(m[1]);
  }
  return names;
}

/** Safe default value generators for known variables (covers common Docker Compose stacks) */
const DEFAULT_GENERATORS: Record<string, () => string> = {
  // Langflow
  LANGFLOW_SECRET_KEY: () => randomBytes(32).toString("hex"),
  LANGFLOW_ADMIN_PASSWORD: () => `admin-${randomBytes(8).toString("hex")}`,
  LANGFLOW_DATABASE_URL: () => "sqlite:///langflow.db",
  LANGFLOW_AUTO_LOGIN: () => "false",
  // Postgres
  POSTGRES_USER: () => "postgres",
  POSTGRES_PASSWORD: () => randomBytes(16).toString("hex"),
  POSTGRES_DB: () => "postgres",
  POSTGRES_INITDB_ARGS: () => "",
  // MySQL / MariaDB
  MYSQL_ROOT_PASSWORD: () => randomBytes(16).toString("hex"),
  MYSQL_PASSWORD: () => randomBytes(16).toString("hex"),
  MYSQL_USER: () => "app",
  MYSQL_DATABASE: () => "app",
  MARIADB_ROOT_PASSWORD: () => randomBytes(16).toString("hex"),
  MARIADB_PASSWORD: () => randomBytes(16).toString("hex"),
  MARIADB_USER: () => "app",
  MARIADB_DATABASE: () => "app",
  // Redis
  REDIS_PASSWORD: () => randomBytes(12).toString("hex"),
  // MongoDB
  MONGO_INITDB_ROOT_USERNAME: () => "admin",
  MONGO_INITDB_ROOT_PASSWORD: () => randomBytes(16).toString("hex"),
  MONGO_INITDB_DATABASE: () => "app",
  // RabbitMQ
  RABBITMQ_DEFAULT_USER: () => "guest",
  RABBITMQ_DEFAULT_PASS: () => randomBytes(12).toString("hex"),
  RABBITMQ_DEFAULT_VHOST: () => "/",
  // Elasticsearch / OpenSearch
  ES_JAVA_OPTS: () => "-Xms512m -Xmx512m",
  discovery_type: () => "single-node",
  // MinIO / S3-compatible
  MINIO_ROOT_USER: () => "minioadmin",
  MINIO_ROOT_PASSWORD: () => randomBytes(16).toString("hex"),
  // Generic secrets and app config
  SECRET_KEY: () => randomBytes(32).toString("hex"),
  SECRET: () => randomBytes(32).toString("hex"),
  ADMIN_PASSWORD: () => `admin-${randomBytes(8).toString("hex")}`,
  JWT_SECRET: () => randomBytes(32).toString("hex"),
  API_KEY: () => randomBytes(24).toString("hex"),
  DATABASE_URL: () => "postgresql://postgres:changeme@db:5432/postgres",
  NODE_ENV: () => "production",
  DEBUG: () => "false",
  TZ: () => "UTC",
  PUID: () => "1000",
  PGID: () => "1000",
  UMASK: () => "022",
  // App-specific common
  GITHUB_TOKEN: () => "",
  OPENAI_API_KEY: () => "",
  OLLAMA_HOST: () => "http://host.docker.internal:11434",
};

/**
 * Generate .env file content from docker-compose content.
 * Extracts variable names, assigns safe defaults for known vars, and placeholder for unknown.
 */
export function generateEnvFromCompose(composeContent: string): string {
  const names = extractEnvVarNames(composeContent);
  const lines: string[] = [
    "# Generated for docker-compose - edit as needed",
    "",
  ];

  const sorted = [...names].sort();
  if (sorted.length === 0) return "";

  for (const name of sorted) {
    const generator = DEFAULT_GENERATORS[name];
    const value = generator ? generator() : "";
    // Escape value: if it contains space, #, or newline, quote it
    const needsQuotes = /[\s#"\\]/.test(value) || value === "";
    const escaped = needsQuotes
      ? `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
      : value;
    lines.push(`${name}=${escaped}`);
  }

  return lines.join("\n").trim();
}
