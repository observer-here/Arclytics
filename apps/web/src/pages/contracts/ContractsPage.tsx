import { Link } from "react-router-dom";
import { protocols } from "@arclytics/protocols";
import { shortHash } from "@/utils/format";

export function ContractsPage() {
  const rows = protocols.flatMap((p) =>
    p.contracts.map((c) => ({
      protocol: p.name,
      slug: p.slug,
      address: c.address,
      role: c.role,
      label: c.label ?? c.role,
    })),
  );

  return (
    <div className="space-y-2.5">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Label</th>
              <th>Role</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.slug}-${r.address}`}>
                <td>
                  <Link to={`/protocols/${r.slug}`} className="font-medium text-ink-800 hover:text-arc-700">
                    {r.protocol}
                  </Link>
                </td>
                <td>{r.label}</td>
                <td className="capitalize text-ink-500">{r.role}</td>
                <td className="font-mono text-xs text-ink-500">{shortHash(r.address, 10, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
