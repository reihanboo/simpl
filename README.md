<pre>
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣎⠱⣲⠀⠀kys⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⡠⠤⠒⠒⠒⠒⠤⢄⣈⠈⠁⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢀⡤⠒⠝⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠲⢄⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⢀⡴⠋⠀⠀⠀⠀⣀⠀⠀⠀⠀⠀⠀⢠⣢⠐⡄⠀⠉⠑⠒⠒⠒⣄
⠀⠀⠀⣀⠴⠋⠀⠀⠀⡎⢀⣘⠿⠀⠀⢠⣀⢄⡦⠀⣛⣐⢸⠀⠀⠀⠀⠀⠀⢘
⡠⠒⠉⠀⠀⠀⠀⠀⡰⢅⠣⠤⠘⠀⠀⠀⠀⠀⠀⢀⣀⣤⡋⠙⠢⢄⣀⣀⡠⠊
⢇⠀⠀⠀⠀⠀⢀⠜⠁⠀⠉⡕⠒⠒⠒⠒⠒⠛⠉⠹⡄⣀⠘⡄⠀⠀⠀⠀⠀⠀
⠀⠑⠂⠤⠔⠒⠁⠀⠀⡎⠱⡃⠀⠀⡄⠀⠄⠀⠀⠠⠟⠉⡷⠁⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⠤⠤⠴⣄⡸⠤⣄⠴⠤⠴⠄⠼⠀⠀⠀⠀⠀⠀⠀⠀
</pre>

## Development & Running

### Local Development (without Docker)
In root, run `npm i` then run `npm run dev` oki oki.

### Docker Development (with Hot Reloading)
```bash
docker compose -f docker-compose.dev.yml up --build
```

### Docker Production Release
```bash
docker compose up --build -d
```

For full documentation, see [DOCKER.md].

### Seed showcase data

With PostgreSQL running and the database environment variables configured, run from `backend`:

```bash
go run ./cmd/seed
```

The seeder is safe to run repeatedly; it uses stable demo record IDs and does not clear other database data. It creates one UMKM and one Enterprise business, branches, sales and inventory history, customers and loyalty data, employee roles and attendance, co-owner membership, a pending invitation, and AI chat history.

Demo accounts all use the password `SIMPLdemo123!`:

| Account | Login |
| --- | --- |
| Business owner | `demo.owner@simpl.test` |
| Co-owner | `demo.coowner@simpl.test` |
| Pending invite recipient | `demo.invited@simpl.test` |
| Store manager | `demo.manager@simpl.test` or `staff_demo_manager` |
| Cashier | `demo.cashier@simpl.test` or `staff_demo_cashier` |
| Warehouse staff | `demo.warehouse@simpl.test` or `staff_demo_warehouse` |

> This seeder creates known-password accounts and is for local/demo databases only. Do not run it against production data.
