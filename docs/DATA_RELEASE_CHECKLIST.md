# CounterLens Public Data Release Checklist

Use this checklist before replacing the synthetic dataset. It separates research authorization from public-web publication and makes the release decision reproducible.

## 1. Authority and purpose

- Record the dataset owner, PI, approved study purpose, and applicable IRB protocol.
- Check the data-use agreement and institutional policy for **public browser display**, not only research-team access.
- Obtain an explicit decision on whether row-level de-identified records may be sent to anonymous website visitors.
- Define a retention and deletion date for source, transformed, and monitoring data.

Do not set `approvedForPublicDisplay: true` solely because an IRB protocol exists.

## 2. Separate source data from the public release

- Never commit source files, lookup tables, record-linkage keys, or direct identifiers to Git.
- Perform cleaning and de-identification outside the public application repository.
- Generate new opaque, release-specific record IDs. Do not hash a student ID and expose the hash.
- Keep the transformation recipe and approval record in the institutionally approved research environment.
- Give the application only the final approved release artifact.

## 3. Review direct and indirect identifiers

Confirm removal or approved transformation of names, emails, student IDs, precise dates, addresses, free text, and other direct identifiers.

Then review combinations of indirect identifiers, including small programs, rare student levels, demographic combinations, unusual scores, cohort/year, and graduation status. Removing names alone is not sufficient.

For a public classroom experience, prefer one of these representations:

1. synthetic records derived from approved distribution summaries;
2. binned or coarsened points with small cells suppressed;
3. row-level de-identified records only when the data owner explicitly approves that disclosure risk.

Visual jitter is not a de-identification method.

## 4. Define every feature

Each feature needs:

- stable `key` and human-readable label;
- `type`: `number`, `boolean`, `category`, or `ordinal`;
- `role`: `input`, `group`, or `outcome`;
- approved uses: `axis`, `compare`, and/or `counterfactual`;
- permitted values or numeric range;
- an explicit missing-value rule.

Treat graduation status as an outcome unless the research design gives a defensible reason otherwise. Do not use an outcome as an input to predict itself; that creates label leakage.

## 5. Validate the release

- Schema/type validation passes.
- Record IDs are unique and unrelated to institutional identifiers.
- Missing, invalid, duplicate, and out-of-range counts have been reviewed.
- Small-group and linkage risks have been reviewed across likely feature combinations.
- Policies reference only approved input features.
- `dataset.version` is immutable and documented.
- `containsDirectIdentifiers` is `false`.
- The authorized release owner approves `approvedForPublicDisplay: true`.

## 6. Pilot before public deployment

- Test with a small approved release on the UMBC server.
- Inspect the actual network response in a browser; assume every returned field can be downloaded.
- Confirm errors and server logs do not contain records or secrets.
- Verify monitoring accepts only the documented event fields.
- Record the dataset version and policy version used in the classroom/research protocol.

Useful official references:

- [U.S. Department of Education FERPA resources](https://studentprivacy.ed.gov/ferpa)
- [NISTIR 8053: De-Identification of Personal Information](https://www.nist.gov/publications/de-identification-personal-information)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
