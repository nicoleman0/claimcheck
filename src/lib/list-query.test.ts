import { expect, test } from "bun:test";

import { listHref, readListQuery } from "./list-query";

const opts = { sorts: ["name", "date"] as const, defaultSort: "date" as const, defaultDir: "desc" as const, filters: ["open", "closed"] as const };

test("readListQuery keeps allow-listed values and falls back otherwise", () => {
  expect(readListQuery({ page: "3", sort: "name", dir: "asc", q: " acme ", filter: "open" }, opts)).toEqual({
    page: 3, size: 20, offset: 40, sort: "name", dir: "asc", q: "acme", filter: "open",
  });
  expect(readListQuery({ page: "0", sort: "drop table", dir: "up", filter: "x" }, opts)).toEqual({
    page: 1, size: 20, offset: 0, sort: "date", dir: "desc", q: "", filter: null,
  });
});

test("listHref resets the page when anything but the page changes", () => {
  const q = readListQuery({ page: "3", sort: "name", dir: "asc", q: "acme" }, opts);
  expect(listHref("/x", q, { page: 4 })).toBe("/x?page=4&sort=name&dir=asc&q=acme");
  expect(listHref("/x", q, { filter: "open" })).toBe("/x?sort=name&dir=asc&q=acme&filter=open");
});
