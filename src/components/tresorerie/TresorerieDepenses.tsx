import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, TrendingDown } from "lucide-react";
import { DepensesRealisees } from "./DepensesRealisees";
import { DepensesPrevisionnelles } from "./DepensesPrevisionnelles";

export function TresorerieDepenses() {
  return (
    <Tabs defaultValue="realises" className="space-y-4">
      <TabsList className="h-9">
        <TabsTrigger value="realises" className="gap-1.5">
          <Landmark className="h-3.5 w-3.5" />
          Réalisés
        </TabsTrigger>
        <TabsTrigger value="previsionnel" className="gap-1.5">
          <TrendingDown className="h-3.5 w-3.5" />
          Prévisionnel
        </TabsTrigger>
      </TabsList>
      <TabsContent value="realises">
        <DepensesRealisees />
      </TabsContent>
      <TabsContent value="previsionnel">
        <DepensesPrevisionnelles />
      </TabsContent>
    </Tabs>
  );
}
