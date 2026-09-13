import type { NextConfig } from "next";

const securityHeaders = [
  // No page here is meant to be framed by another site -- blocks clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops the browser from guessing a file's type from its content (e.g. treating an
  // uploaded file as HTML/JS instead of the declared type).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Never leak the full URL (which can carry ids/paths) to a different origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // This app never uses the camera/microphone/geolocation -- explicitly disable them.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
