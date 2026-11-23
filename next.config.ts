import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Las migraciones se leen al arrancar, así que tienen que viajar con el servidor.
  outputFileTracingIncludes: { "/**": ["./migrations/**"] },
  async redirects() {
    return [
      { source: "/natvisual/calendario", destination: "/natvisual", permanent: false },
      { source: "/natvisual/tareas", destination: "/natvisual", permanent: false },
      { source: "/natvisual/informe", destination: "/natvisual/ajustes", permanent: false },
    ];
  },
};

export default nextConfig;
