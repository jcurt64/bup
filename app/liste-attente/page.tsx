// Server Component : on lit searchParams côté serveur (pas de bail-out
// du static generation contrairement à useSearchParams() qui exigerait
// un <Suspense> wrapper). On délègue au composant client juste le
// listener postMessage pour le retour vers la home depuis l'iframe.

import WaitlistFrame from "./WaitlistFrame";
import { getWaitlistOpen } from "@/lib/app-config/access";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

export default async function WaitlistPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;

  // Reconstruit la query string pour la propager à l'iframe statique
  // (utile pour `?simulate-launch=Xmin` qui active la simulation
  // côté waitlist.html).
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") {
      qs.append(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    }
  }
  // Gel de la pré-inscription : le HTML statique n'a aucun accès à la base,
  // on lui passe donc l'état par la query string. `delete` d'abord, pour
  // qu'un visiteur ne puisse pas forcer l'ouverture en ajoutant le
  // paramètre lui-même dans l'URL. Cf. lib/app-config/access.ts.
  qs.delete("waitlist-closed");
  if (!(await getWaitlistOpen())) qs.set("waitlist-closed", "1");

  const queryString = qs.toString();
  const src = queryString
    ? `/prototype/waitlist.html?${queryString}`
    : "/prototype/waitlist.html";

  return <WaitlistFrame src={src} />;
}
