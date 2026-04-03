# Cloudflare Durable Objects Storage Config Research

## Key Findings

### 1. `new_sqlite_classes` vs `new_classes`

**`new_sqlite_classes`**: SQLite storage backend. Stores relational data, supports SQL queries, Point In Time Recovery (30-day restore). **Recommended for all new deployments.**

**`new_classes`**: Legacy key-value storage backend. Backwards-compatible only. Limited to Workers Paid plan.

### 2. Free Plan Requirement

Cloudflare **only allows SQLite-backed Durable Objects on the Free plan**. The key-value backend (`new_classes`) is exclusive to Paid plans. This is a hard constraint—free users must use `new_sqlite_classes`.

### 3. Functional Differences & Limitations

| Aspect | SQLite | Key-Value |
|--------|--------|-----------|
| **Plan Support** | Free + Paid | Paid only |
| **Storage API** | Key-value + SQL | Key-value only |
| **Storage Limit (Free)** | 1 GB per object | N/A |
| **Storage Limit (Paid)** | 10 GB per object | Unlimited |
| **Features** | PITR, transactions, indexes | Simple K-V ops |
| **Migration** | One-way: can't convert key-value to SQLite without data deletion |

### 4. Critical Constraint

**Cannot retroactively enable SQLite** on existing key-value classes. Must choose at initial deployment. No conversion path without deleting data.

## Recommendation

Use `new_sqlite_classes` for all new Durable Object deployments—it's the only free-plan-compatible option and standard Cloudflare practice. Key-value backend is legacy; use only if maintaining existing Paid deployments.

---

**Sources:**
- [Durable Objects Migrations](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)
- [SQLite Storage Limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Pricing Guide](https://developers.cloudflare.com/durable-objects/platform/pricing/)
