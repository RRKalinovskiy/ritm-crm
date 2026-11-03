import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Field, Input, Select } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import {
  importPriceList,
  listCategories,
  listServices,
  listSpecialists,
  type PriceImportServiceRow,
} from '@/db/repositories';
import type { Category, Service, Specialist } from '@/domain/types';
import { formatDuration } from '@/domain/date';
import { formatRub } from '@/domain/money';
import { cn } from '@/lib/utils';
import {
  EMPTY_MAPPING,
  PRICE_FIELDS,
  cellText,
  columnLetter,
  detectColumnMapping,
  detectHeaderRow,
  mappingProblem,
  normalizeKey,
  parsePriceRows,
  type ColumnMapping,
  type ParsedPriceRow,
} from '@/features/services/priceImport';

interface PriceImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024;

function columnCount(rows: string[][]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 0);
}

function rawHeaders(rows: string[][], headerRow: number): string[] {
  const count = columnCount(rows);
  return Array.from({ length: count }, (_, index) =>
    cellText(rows[headerRow - 1]?.[index] ?? ''),
  );
}

function displayHeaders(rows: string[][], headerRow: number): string[] {
  return rawHeaders(rows, headerRow).map(
    (header, index) => header || `Колонка ${columnLetter(index)}`,
  );
}

export function PriceImportModal({
  open,
  onOpenChange,
  onImported,
}: PriceImportModalProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [rows, setRows] = useState<string[][]>([]);
  const [headerRow, setHeaderRow] = useState(1);
  const [headerRowInput, setHeaderRowInput] = useState('1');
  const [mapping, setMapping] = useState<ColumnMapping>({ ...EMPTY_MAPPING });
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [existingCategories, setExistingCategories] = useState<Category[]>([]);
  const [existingSpecialists, setExistingSpecialists] = useState<Specialist[]>([]);
  const [existingServices, setExistingServices] = useState<Service[]>([]);

  useEffect(() => {
    if (!open) return;
    setFileName('');
    setWorkbook(null);
    setSheetName('');
    setRows([]);
    setHeaderRow(1);
    setHeaderRowInput('1');
    setMapping({ ...EMPTY_MAPPING });
    setFileError('');
    setDragOver(false);
    setImporting(false);
    void Promise.all([listCategories(), listSpecialists(), listServices()]).then(
      ([categories, specialists, services]) => {
        setExistingCategories(categories);
        setExistingSpecialists(specialists);
        setExistingServices(services);
      },
    );
  }, [open]);

  function applyHeader(data: string[][], nextHeaderRow: number) {
    const clamped = Math.min(Math.max(1, nextHeaderRow), Math.max(data.length, 1));
    setHeaderRow(clamped);
    setHeaderRowInput(String(clamped));
    setMapping(detectColumnMapping(rawHeaders(data, clamped)));
  }

  function loadSheet(book: XLSX.WorkBook, name: string) {
    const sheet = book.Sheets[name];
    if (!sheet) {
      setFileError('Выбранный лист не найден в файле.');
      return;
    }
    setRows([]);
    setMapping({ ...EMPTY_MAPPING });
    setHeaderRow(1);
    setHeaderRowInput('1');
    try {
      const raw = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: true,
        defval: '',
        blankrows: true,
      }) as unknown[][];
      const nextRows = raw.map((row) =>
        (Array.isArray(row) ? row : [row]).map((cell) => cellText(cell)),
      );
      while (
        nextRows.length > 0 &&
        nextRows[nextRows.length - 1].every((cell) => !cell)
      ) {
        nextRows.pop();
      }
      if (nextRows.length === 0) {
        setFileError('На выбранном листе нет данных.');
        return;
      }
      setRows(nextRows);
      applyHeader(nextRows, detectHeaderRow(nextRows));
      setFileError('');
    } catch {
      setFileError('Не удалось прочитать лист. Проверьте формат файла.');
    }
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileError('');
    if (file.size > MAX_FILE_SIZE) {
      setFileError('Файл больше 15 МБ. Разделите прайс на части и загрузите по очереди.');
      return;
    }
    setFileName(file.name);
    setWorkbook(null);
    setSheetName('');
    setRows([]);
    setMapping({ ...EMPTY_MAPPING });
    try {
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { type: 'array', cellDates: false });
      if (!book.SheetNames || book.SheetNames.length === 0) {
        setFileError('В файле не найдено ни одного листа.');
        return;
      }
      const firstSheet = book.SheetNames[0];
      setWorkbook(book);
      setSheetName(firstSheet);
      loadSheet(book, firstSheet);
    } catch {
      setFileName('');
      setFileError('Не удалось открыть файл. Поддерживаются XLSX, XLS и CSV.');
    }
  }

  function clearFile() {
    setFileName('');
    setWorkbook(null);
    setSheetName('');
    setRows([]);
    setHeaderRow(1);
    setHeaderRowInput('1');
    setMapping({ ...EMPTY_MAPPING });
    setFileError('');
    setDragOver(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleSheetChange(nextSheet: string) {
    if (!workbook) return;
    setSheetName(nextSheet);
    loadSheet(workbook, nextSheet);
  }

  function handleHeaderInput(value: string) {
    setHeaderRowInput(value);
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= rows.length) {
      applyHeader(rows, parsed);
    }
  }

  function handleHeaderBlur() {
    const parsed = Number(headerRowInput);
    applyHeader(rows, Number.isInteger(parsed) ? parsed : headerRow);
  }

  const headers = useMemo(
    () => displayHeaders(rows, headerRow),
    [rows, headerRow],
  );

  const problem = mappingProblem(mapping);
  const parsedRows = useMemo(() => {
    if (rows.length === 0 || mappingProblem(mapping)) return [];
    return parsePriceRows(rows.slice(headerRow), mapping, headerRow + 1);
  }, [rows, headerRow, mapping]);

  const validRows = useMemo(
    () => parsedRows.filter((row) => row.errors.length === 0),
    [parsedRows],
  );
  const invalidRows = useMemo(
    () => parsedRows.filter((row) => row.errors.length > 0),
    [parsedRows],
  );

  const uniqueValidRows = useMemo(() => {
    const unique = new Map<string, ParsedPriceRow>();
    for (const row of validRows) {
      const key = `${normalizeKey(row.categoryName)}|${normalizeKey(row.name)}`;
      unique.delete(key);
      unique.set(key, row);
    }
    return [...unique.values()];
  }, [validRows]);

  const existingCategoryKeys = useMemo(
    () => new Set(existingCategories.map((category) => normalizeKey(category.name))),
    [existingCategories],
  );
  const existingSpecialistKeys = useMemo(
    () => new Set(existingSpecialists.map((specialist) => normalizeKey(specialist.name))),
    [existingSpecialists],
  );
  const existingServiceKeys = useMemo(() => {
    const categoryNames = new Map(
      existingCategories.map((category) => [category.id, category.name]),
    );
    return new Set(
      existingServices.map(
        (service) =>
          `${normalizeKey(categoryNames.get(service.categoryId) ?? '')}|${normalizeKey(service.name)}`,
      ),
    );
  }, [existingCategories, existingServices]);

  const newCategoryNames = useMemo(() => {
    const result = new Map<string, string>();
    for (const row of uniqueValidRows) {
      const key = normalizeKey(row.categoryName);
      if (!key || existingCategoryKeys.has(key)) continue;
      if (!result.has(key)) result.set(key, row.categoryName);
    }
    return [...result.values()];
  }, [uniqueValidRows, existingCategoryKeys]);

  const newSpecialistNames = useMemo(() => {
    const result = new Map<string, string>();
    for (const row of uniqueValidRows) {
      for (const name of row.specialistNames) {
        const key = normalizeKey(name);
        if (!key || existingSpecialistKeys.has(key)) continue;
        if (!result.has(key)) result.set(key, name);
      }
    }
    return [...result.values()];
  }, [uniqueValidRows, existingSpecialistKeys]);

  const newServiceCount = useMemo(
    () =>
      uniqueValidRows.filter(
        (row) =>
          !existingServiceKeys.has(
            `${normalizeKey(row.categoryName)}|${normalizeKey(row.name)}`,
          ),
      ).length,
    [uniqueValidRows, existingServiceKeys],
  );
  const updatedServiceCount = uniqueValidRows.length - newServiceCount;
  const duplicateCount = validRows.length - uniqueValidRows.length;
  const canImport =
    Boolean(workbook) && !problem && uniqueValidRows.length > 0 && !importing;

  async function handleImport() {
    if (!canImport) return;
    setImporting(true);
    const payload: PriceImportServiceRow[] = uniqueValidRows.map((row) => ({
      categoryName: row.categoryName,
      name: row.name,
      priceRub: row.priceRub,
      durationMin: row.durationMin,
      costRub: row.costRub,
      description: row.description,
      specialistNames: row.specialistNames,
    }));

    try {
      const result = await importPriceList(payload, {
        hasCostColumn: mapping.cost != null,
        hasDescriptionColumn: mapping.description != null,
        hasSpecialistColumn: mapping.specialist != null,
      });
      const parts = [
        `Новых услуг: ${result.createdServices}`,
        `обновлено: ${result.updatedServices}`,
      ];
      if (result.createdCategories > 0) {
        parts.push(`новых категорий: ${result.createdCategories}`);
      }
      if (result.createdSpecialists > 0) {
        parts.push(`новых специалистов: ${result.createdSpecialists}`);
      }
      toast({
        title: 'Прайс импортирован',
        description: parts.join(' · '),
      });
      onImported?.();
      onOpenChange(false);
    } catch (cause) {
      toast({
        title: 'Не удалось импортировать прайс',
        description: cause instanceof Error ? cause.message : 'Проверьте файл и попробуйте ещё раз',
        tone: 'error',
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Импорт прайса из Excel"
      description="Загрузите файл, укажите строку заголовков и сопоставьте колонки с полями прайса."
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={importing}>
            Отмена
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            <Upload size={14} />
            {importing
              ? 'Импортируем…'
              : uniqueValidRows.length > 0
                ? `Импортировать ${uniqueValidRows.length}`
                : 'Импортировать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-label="Файл прайса"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            void handleFile(file);
          }}
        />

        {fileName ? (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-[#FBFCFB] p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <FileSpreadsheet size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-ink">{fileName}</div>
              <div className="mt-0.5 text-[10px] text-muted">
                {rows.length > 0 ? `${rows.length} строк в листе` : 'Файл загружен'} ·{' '}
                {workbook?.SheetNames.length ?? 0}{' '}
                {workbook?.SheetNames.length === 1 ? 'лист' : 'листов'}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={importing}
            >
              Заменить файл
            </Button>
            <button
              type="button"
              onClick={clearFile}
              disabled={importing}
              className="rounded-lg p-2 text-muted transition hover:bg-white hover:text-danger disabled:opacity-50"
              aria-label="Убрать файл"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              void handleFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center transition',
              dragOver
                ? 'border-primary bg-primary-faint'
                : 'border-line bg-[#FBFCFB] hover:border-primary/40 hover:bg-primary-faint',
            )}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Upload size={19} />
            </span>
            <span className="text-[13px] font-bold text-ink">
              Выберите Excel-файл или перетащите его сюда
            </span>
            <span className="text-[10px] text-muted">
              XLSX, XLS или CSV · до 15 МБ. Структура файла может быть любой.
            </span>
          </button>
        )}

        {fileError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[11px] font-medium leading-5 text-danger"
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {fileError}
          </div>
        )}

        {workbook && rows.length > 0 && (
          <>
            <div className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Лист" className="min-w-[220px] flex-1">
                  <Select
                    value={sheetName}
                    onChange={(event) => handleSheetChange(event.target.value)}
                    aria-label="Лист Excel"
                  >
                    {workbook.SheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Строка заголовков"
                  hint="Номер строки, где находятся названия колонок"
                  className="w-[180px]"
                >
                  <Input
                    type="number"
                    min={1}
                    max={rows.length}
                    value={headerRowInput}
                    onChange={(event) => handleHeaderInput(event.target.value)}
                    onBlur={handleHeaderBlur}
                    aria-label="Строка заголовков"
                  />
                </Field>
                <Button
                  variant="secondary"
                  onClick={() => applyHeader(rows, headerRow)}
                  title="Определить поля по названиям колонок"
                >
                  <RefreshCw size={14} />
                  Определить поля
                </Button>
              </div>
              <div className="mt-2 text-[10px] leading-4 text-muted">
                Если в файле есть шапка или пустые строки, укажите строку с названиями колонок.
                Строки ниже неё попадут в предпросмотр.
              </div>
            </div>

            <div className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[12px] font-bold text-ink">Сопоставление колонок</div>
                  <div className="mt-0.5 text-[10px] text-muted">
                    Укажите, какая колонка соответствует каждому полю прайса
                  </div>
                </div>
                <Badge tone={problem ? 'warning' : 'success'} dot>
                  {problem ? 'Проверьте поля' : 'Поля сопоставлены'}
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                {PRICE_FIELDS.map((field) => (
                  <Field
                    key={field.key}
                    label={`${field.label}${field.required ? ' *' : ''}`}
                    hint={field.hint}
                  >
                    <Select
                      value={mapping[field.key] == null ? '' : String(mapping[field.key])}
                      onChange={(event) =>
                        setMapping((current) => ({
                          ...current,
                          [field.key]:
                            event.target.value === '' ? null : Number(event.target.value),
                        }))
                      }
                      aria-label={`Колонка для поля ${field.label}`}
                    >
                      <option value="">
                        {field.required ? 'Выберите колонку' : 'Не импортировать'}
                      </option>
                      {headers.map((header, index) => (
                        <option key={`${field.key}-${index}`} value={index}>
                          {columnLetter(index)} — {header}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ))}
              </div>

              {problem && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[10px] font-medium leading-4 text-[#7A5010]">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {problem}
                </div>
              )}
            </div>

            {!problem && (
              <>
                <div className="grid grid-cols-4 gap-2.5">
                  <PreviewStat
                    label="К импорту"
                    value={String(uniqueValidRows.length)}
                    hint={
                      duplicateCount > 0
                        ? `${duplicateCount} повторяющихся строк объединим`
                        : 'уникальных услуг'
                    }
                  />
                  <PreviewStat
                    label="Новые услуги"
                    value={String(newServiceCount)}
                    hint={`${updatedServiceCount} обновятся`}
                  />
                  <PreviewStat
                    label="Категории"
                    value={newCategoryNames.length > 0 ? `+${newCategoryNames.length}` : '0'}
                    hint="новых категорий"
                  />
                  <PreviewStat
                    label="Специалисты"
                    value={
                      newSpecialistNames.length > 0 ? `+${newSpecialistNames.length}` : '0'
                    }
                    hint="новых мастеров"
                  />
                </div>

                {uniqueValidRows.length > 0 && (
                  <div className="overflow-hidden rounded-xl border border-line">
                    <div className="flex items-center justify-between gap-3 border-b border-line bg-[#FBFCFB] px-4 py-3">
                      <div className="flex items-center gap-2 text-[12px] font-bold text-ink">
                        <CheckCircle2 size={15} className="text-primary" />
                        Предпросмотр прайса
                      </div>
                      <div className="text-[10px] text-muted">
                        Показаны первые {Math.min(uniqueValidRows.length, 8)} из{' '}
                        {uniqueValidRows.length}
                      </div>
                    </div>
                    <div className="max-h-[250px] overflow-auto">
                      <table className="w-full min-w-[820px] table-fixed border-collapse">
                        <colgroup>
                          <col className="w-[42px]" />
                          <col className="w-[150px]" />
                          <col />
                          <col className="w-[105px]" />
                          <col className="w-[92px]" />
                          <col className="w-[155px]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-line text-left text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8A938D]">
                            <th className="px-3 py-2 font-semibold">#</th>
                            <th className="px-3 py-2 font-semibold">Категория</th>
                            <th className="px-3 py-2 font-semibold">Услуга</th>
                            <th className="px-3 py-2 text-right font-semibold">Цена</th>
                            <th className="px-3 py-2 font-semibold">Время</th>
                            <th className="px-3 py-2 font-semibold">Специалист</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uniqueValidRows.slice(0, 8).map((row) => (
                            <tr
                              key={`${row.rowNumber}-${row.name}`}
                              className="border-b border-line/60 last:border-b-0"
                            >
                              <td className="px-3 py-2 text-[10px] tabular-nums text-muted">
                                {row.rowNumber}
                              </td>
                              <td className="truncate px-3 py-2 text-[11px] text-[#4E5C55]">
                                {row.categoryName}
                              </td>
                              <td className="px-3 py-2">
                                <div className="truncate text-[11px] font-semibold text-ink">
                                  {row.name}
                                </div>
                                {row.description && (
                                  <div className="mt-0.5 truncate text-[9px] text-muted">
                                    {row.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="text-[11px] font-bold tabular-nums text-ink">
                                  {formatRub(row.priceRub)}
                                </div>
                                {row.costRub != null && (
                                  <div className="mt-0.5 text-[9px] tabular-nums text-muted">
                                    себест. {formatRub(row.costRub)}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-[10px] text-[#4E5C55]">
                                {formatDuration(row.durationMin)}
                              </td>
                              <td className="truncate px-3 py-2 text-[10px] text-[#4E5C55]">
                                {row.specialistNames.length > 0
                                  ? row.specialistNames.join(', ')
                                  : mapping.specialist != null
                                    ? 'Не указаны'
                                    : 'Все активные'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {invalidRows.length > 0 && (
                  <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-[#7A5010]">
                      <AlertTriangle size={14} />
                      Строки с ошибками: {invalidRows.length}. Они будут пропущены.
                    </div>
                    <div className="mt-2 flex flex-col gap-1 text-[10px] leading-4 text-[#7A5010]">
                      {invalidRows.slice(0, 5).map((row) => (
                        <div key={row.rowNumber}>
                          Строка {row.rowNumber}: {row.errors.join('; ')}
                        </div>
                      ))}
                      {invalidRows.length > 5 && (
                        <div>И ещё {invalidRows.length - 5} строк с ошибками.</div>
                      )}
                    </div>
                  </div>
                )}

                {uniqueValidRows.length === 0 && (
                  <div className="rounded-xl border border-line bg-[#FBFCFB] px-4 py-5 text-center text-[11px] text-muted">
                    В файле не найдено ни одной корректной строки. Проверьте строку заголовков и
                    сопоставление колонок.
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-xl bg-primary-faint px-4 py-3 text-[10px] leading-4 text-[#4E5C65]">
                  <FileSpreadsheet size={14} className="mt-0.5 shrink-0 text-primary" />
                  Услуги с совпадающей категорией и названием будут обновлены. Новые категории и
                  специалисты создадутся автоматически. Если колонка «Специалист» не выбрана,
                  новые услуги будут доступны всем активным мастерам.
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function PreviewStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-[#FBFCFB] px-3 py-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.06em] text-muted">{label}</div>
      <div className="mt-1 text-[17px] font-extrabold tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 truncate text-[9px] text-muted">{hint}</div>
    </div>
  );
}
