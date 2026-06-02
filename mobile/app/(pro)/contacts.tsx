// Contacts acquis — /api/pro/contacts. E-mail/téléphone renvoyés MASQUÉS par
// le serveur (alias watermarqué / numéro tronqué) : l'app affiche ce que l'API
// renvoie, jamais les vraies coordonnées brutes (invariant RGPD/anti-fraude —
// cf. MOBILE_APP_SPEC §6.4).
//
// Design : maquette co.html (liste) + co2.html (détail). Titre, carte
// « Filtres combinés », puis contacts groupés par campagne sous forme de
// cartes (cf. components/contact-cards.tsx) et fiche détail en bottom-sheet
// (cf. components/contact-detail-sheet.tsx). Les maquettes sont en thème
// forest ; toutes les couleurs vives passent par useContactPalette pour
// s'adapter aux thèmes buupp / sombre / fushia.
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { QueryGate, ScrollScreen } from "../../components/screen";
import {
  ContactCard,
  FILTERS,
  FiltersCard,
  GroupHeader,
  type FilterKey,
} from "../../components/contact-cards";
import {
  ContactDetailSheet,
  useContactPalette,
} from "../../components/contact-detail-sheet";
import { useProContacts, type ProContact } from "../../lib/queries";

export default function Contacts() {
  const q = useProContacts();
  const p = useContactPalette();
  const [active, setActive] = useState<Set<FilterKey>>(new Set());
  const [selected, setSelected] = useState<ProContact | null>(null);

  const toggle = (k: FilterKey) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // Filtrage cumulatif + regroupement par campagne (ordre d'apparition).
  const groups = useMemo(() => {
    const rows = q.data?.rows ?? [];
    const filtered = rows.filter((r) =>
      [...active].every((k) => FILTERS.find((f) => f.key === k)!.test(r)),
    );
    const map = new Map<string, ProContact[]>();
    for (const r of filtered) {
      const key = r.campaign || "Sans campagne";
      (map.get(key) ?? map.set(key, []).get(key)!).push(r);
    }
    return [...map.entries()].map(([campaign, contacts]) => ({ campaign, contacts }));
  }, [q.data, active]);

  const total = q.data?.rows?.length ?? 0;
  const shown = groups.reduce((n, g) => n + g.contacts.length, 0);

  return (
    <ScrollScreen onRefresh={q.refetch} headerVariant="pro">
      {/* Titre */}
      <View style={{ gap: 1 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1.6,
            color: p.accent,
            textTransform: "uppercase",
          }}
        >
          Mes contacts
        </Text>
        <Text className="font-serif text-2xl" style={{ color: p.text, marginTop: 4 }}>
          Prospects ayant accepté
        </Text>
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: p.sub, marginTop: 6 }}>
          Données accessibles dans l’app uniquement — un watermark est appliqué à
          chaque fiche.
        </Text>
      </View>

      <QueryGate
        query={q}
        isEmpty={(d) => (d.rows?.length ?? 0) === 0}
        emptyLabel="Aucun contact acquis pour le moment."
      >
        {() => (
          <View style={{ gap: 18 }}>
            <FiltersCard
              active={active}
              onToggle={toggle}
              onClear={() => setActive(new Set())}
              shown={shown}
              total={total}
            />
            {groups.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: p.border,
                  backgroundColor: p.card,
                  padding: 24,
                }}
              >
                <Text style={{ fontSize: 13, color: p.muted, textAlign: "center" }}>
                  Aucun prospect ne correspond à ces filtres.
                </Text>
              </View>
            ) : (
              groups.map((g) => (
                <View key={g.campaign}>
                  <GroupHeader campaign={g.campaign} count={g.contacts.length} />
                  <View style={{ gap: 12 }}>
                    {g.contacts.map((c) => (
                      <ContactCard
                        key={c.relationId}
                        contact={c}
                        onDetails={() => setSelected(c)}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </QueryGate>

      <ContactDetailSheet
        contact={selected}
        campaign={selected?.campaign ?? null}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </ScrollScreen>
  );
}
