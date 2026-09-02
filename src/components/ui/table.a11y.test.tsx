import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import { expect, describe, it } from 'vitest';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from './table';

expect.extend({ toHaveNoViolations });

describe('Table a11y', () => {
  it('table with caption + headers has no a11y violations', async () => {
    const { container } = render(
      <Table>
        <TableCaption>Liste des établissements</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Nom</TableHead>
            <TableHead scope="col">Ville</TableHead>
            <TableHead scope="col">Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>EHPAD Les Lilas</TableCell>
            <TableCell>Lyon</TableCell>
            <TableCell>Production</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Clinique Saint-Joseph</TableCell>
            <TableCell>Paris</TableCell>
            <TableCell>Prospect</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
