import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, TrendingUp } from "lucide-react";
import { RevenusRealises } from "./RevenusRealises";
import { RevenusPrevisionnels } from "./RevenusPrevisionnels";

export function TresorerieRevenus() {
  return (
    <Tabs defaultValue="realises" className="space-y-4">
      <TabsList className="h-9">
        <TabsTrigger value="realises" className="gap-1.5">
          <Landmark className="h-3.5 w-3.5" />
          Réalisés
        </TabsTrigger>
        <TabsTrigger value="previsionnel" className="gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Prévisionnel
        </TabsTrigger>
      </TabsList>
      <TabsContent value="realises">
        <RevenusRealises />
      </TabsContent>
      <TabsContent value="previsionnel">
        <RevenusPrevisionnels />
      </TabsContent>
    </Tabs>
  );
}
