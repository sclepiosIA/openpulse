import { useState } from "react";
import { PrevisionnelSubTabs, PrevisionnelSubTabValue } from "./previsionnel/PrevisionnelSubTabs";
import { PrevisionnelResume } from "./previsionnel/PrevisionnelResume";
import { TresorerieJour } from "./previsionnel/TresorerieJour";
import { TresorerieAnalyseTab } from "./TresorerieAnalyseTab";

export function TresoreriePrevisionnelTab() {
  const [subTab, setSubTab] = useState<PrevisionnelSubTabValue>("resume");

  return (
    <div className="space-y-6">
      {/* Sous-onglets */}
      <PrevisionnelSubTabs value={subTab} onValueChange={setSubTab} />

      {/* Contenu */}
      {subTab === "resume" && <PrevisionnelResume />}
      {subTab === "jour" && <TresorerieJour />}
      {subTab === "previsionnel" && <TresorerieAnalyseTab />}
    </div>
  );
}
