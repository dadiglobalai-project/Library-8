# Dadi Prompt Library API Reference

## GET /api/health

Checks Supabase database connection.

## GET /api/prompts?status=approved&q=keyword

Returns approved prompts for the public library.

Query parameters:

```text
status=approved | pending_review | rejected | archived
q=optional search keyword
limit=optional max rows
```

## POST /api/prompts

Creates one or more prompts.

Without `x-admin-key`, prompts are saved as `pending_review`.
With valid `x-admin-key`, prompts are saved as `approved`.

Body:

```json
{
  "prompts": [
    {
      "id": "CUSTOM-001",
      "title": "Sample Prompt",
      "category": "Uploaded Prompts",
      "structure": "RTCF",
      "expected_output": "structured report",
      "department": "General",
      "level": "Custom",
      "best_use_case": "Use for testing backend uploads.",
      "placeholders": "[Source Material], [Target Audience]",
      "tags": "test, upload",
      "prompt": "Role: You are a Dadi prompt tester..."
    }
  ]
}
```

## GET /api/admin-prompts?status=all

Admin-only. Requires header:

```text
x-admin-key: YOUR_ADMIN_KEY
```

Returns all backend prompts.

## PATCH /api/admin-prompts

Admin-only. Changes prompt status.

Body:

```json
{
  "id": "0001",
  "status": "approved"
}
```

Allowed statuses:

```text
draft
pending_review
approved
rejected
archived
```

## PUT /api/admin-prompts

Admin-only. Creates or updates a prompt.

## DELETE /api/admin-prompts

Admin-only. Deletes a prompt.

Body:

```json
{
  "id": "0001"
}
```

## POST /api/bulk-upload-prompts

Admin-only. Bulk uploads many prompts.

Body:

```json
{
  "prompts": []
}
```

## GET /api/export-prompts

Admin-only. Downloads the full backend prompt database as Excel-compatible `.xls`.
