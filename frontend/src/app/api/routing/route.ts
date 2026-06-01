/**
 * API Route Proxy cho OpenRouteService (ORS)
 *
 * Gọi ORS từ server-side để tránh CORS (ORS không cho phép browser gọi trực tiếp).
 * Client gọi POST /api/routing, route này forward request lên ORS và trả kết quả về.
 *
 * ORS Docs: https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/post
 */

import { NextRequest, NextResponse } from "next/server";

const ORS_API_KEY = process.env.NEXT_PUBLIC_ORS_API_KEY || "";
const ORS_BASE_URL = "https://api.openrouteservice.org/v2";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coordinates } = body;

    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return NextResponse.json(
        { error: "Cần ít nhất 2 tọa độ" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${ORS_BASE_URL}/directions/driving-car`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Accept: "application/json, application/geo+json, application/vnd.geo+json",
          Authorization: ORS_API_KEY,
        },
        body: JSON.stringify({
          coordinates,
          preference: "recommended",
          units: "km",
          instructions: true,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return new NextResponse(
        `ORS API error ${response.status}: ${response.statusText}`,
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API Routing] Proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
