import { ScanRecord } from "../types";

// Types for Google Sheets Setup
export interface GoogleSheetConfig {
  spreadsheetId: string;
  spreadsheetName: string;
  spreadsheetUrl: string;
  autoSync: boolean;
}

/**
 * Create a new Google Spreadsheet and write column headers.
 */
export async function createLogistikSpreadsheet(
  accessToken: string,
  title: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  // 1. Create the spreadsheet
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        title: title || "Data Scan Logistik",
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error("Failed to create spreadsheet:", errText);
    throw new Error(`Gagal membuat spreadsheet: ${createRes.statusText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // 2. Initialize with column headers
  const headers = [
    "No. Urut",
    "Serial ID",
    "No. Resi",
    "Tanggal & Waktu (WIB)",
    "Layanan",
    "Expedisi",
    "Petugas Scan",
  ];

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:G1?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [headers],
      }),
    }
  );

  if (!updateRes.ok) {
    console.warn("Failed to set spreadsheet headers, but spreadsheet was created.");
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Append a single scan record to Google Sheets.
 */
export async function appendScanRowToSheet(
  accessToken: string,
  spreadsheetId: string,
  scan: ScanRecord,
  rowNumber: number
): Promise<boolean> {
  const rowData = [
    rowNumber,
    scan.id,
    scan.resi,
    scan.waktu,
    scan.layanan,
    scan.expedisi,
    scan.userName,
  ];

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:G:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [rowData],
      }),
    }
  );

  if (!res.ok) {
    console.error("Failed to append row:", await res.text());
    return false;
  }

  return true;
}

/**
 * Bulk export all scans into Google Sheets (overwriting/re-initializing the sheet).
 */
export async function exportAllScansToSheet(
  accessToken: string,
  spreadsheetId: string,
  scans: ScanRecord[]
): Promise<boolean> {
  // Sort scans chronological (oldest to newest) for proper serial row index
  const sortedScans = [...scans].sort((a, b) => a.waktu.localeCompare(b.waktu));

  const rows = [
    [
      "No. Urut",
      "Serial ID",
      "No. Resi",
      "Tanggal & Waktu (WIB)",
      "Layanan",
      "Expedisi",
      "Petugas Scan",
    ],
    ...sortedScans.map((scan, index) => [
      index + 1,
      scan.id,
      scan.resi,
      scan.waktu,
      scan.layanan,
      scan.expedisi,
      scan.userName,
    ]),
  ];

  // 1. Clear existing range to start fresh
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:G10000:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 2. Put fresh data starting from A1
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:G${rows.length}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!res.ok) {
    console.error("Failed to batch export rows:", await res.text());
    return false;
  }

  return true;
}

/**
 * Read the current values in Sheet1 to calculate row counts.
 */
export async function getSheetRowCount(
  accessToken: string,
  spreadsheetId: string
): Promise<number> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A:A`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (res.ok) {
      const data = await res.json();
      return (data.values || []).length;
    }
  } catch (err) {
    console.error("Failed to fetch row counts:", err);
  }
  return 0;
}
