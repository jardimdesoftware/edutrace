import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getMetadataStorage } from 'class-validator';

// Com forbidNonWhitelisted, toda propriedade própria da instância do DTO sem
// decorator de validação é recusada, mesmo sem vir do cliente: o TypeScript do
// projeto define os campos declarados na classe, com valor undefined. Um campo
// só documentado (só @ApiProperty) faria a rota responder 400 a qualquer corpo.
function dtoFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return dtoFiles(full);
    }
    return name.endsWith('.dto.ts') ? [full] : [];
  });
}

const dtoClasses = dtoFiles(join(__dirname, '..', '..', 'src')).flatMap(
  (file) =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Object.entries(require(file) as Record<string, unknown>).filter(
      (entry): entry is [string, new () => object] =>
        typeof entry[1] === 'function',
    ),
);

describe('propriedades dos DTOs', () => {
  it('should find the DTO classes', () => {
    expect(dtoClasses.length).toBeGreaterThan(10);
  });

  it.each(dtoClasses)(
    '%s should declare a validator for every own property',
    (_, dtoClass) => {
      const validated = new Set(
        getMetadataStorage()
          .getTargetValidationMetadatas(dtoClass, '', true, false)
          .map((metadata) => metadata.propertyName),
      );

      expect(
        Object.keys(new dtoClass()).filter((key) => !validated.has(key)),
      ).toEqual([]);
    },
  );
});
