import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <main className="shell collectionShell marketplaceShell notFoundShell">
      <SiteHeader />
      <section className="notFoundBody">
        <p className="eyebrow">Telemetry lost · signal 404</p>
        <h1 className="notFoundTitle">
          This world isn&apos;t
          <br />
          on our charts.
        </h1>
        <p className="lede">The page you requested drifted outside the mapped MCV system. Re-enter through the orbital selector.</p>
        <Link href="/" className="notFoundAction">
          Return to the system map
        </Link>
      </section>
      <span className="notFoundGhost" aria-hidden="true">404</span>
    </main>
  );
}
