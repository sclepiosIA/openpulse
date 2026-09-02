import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

expect.extend({ toHaveNoViolations });

describe('Tabs a11y', () => {
  it('tabs with multiple panels have no a11y violations', async () => {
    const { container } = render(
      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="securite">Sécurité</TabsTrigger>
          <TabsTrigger value="notifs">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="profil">Contenu profil</TabsContent>
        <TabsContent value="securite">Contenu sécurité</TabsContent>
        <TabsContent value="notifs">Contenu notifications</TabsContent>
      </Tabs>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
