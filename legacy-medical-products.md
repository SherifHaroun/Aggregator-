# Legacy medical products, in the new model's shape

Source: `cyrilgat_hardbok_v3.sql`, table `hb_medical_insurance_v` (18 rows).

> **These are INDIVIDUAL medical products, not SME.** The dump on this machine
> is the public site's database. The SME/group products live in the admin
> database `cyrilgat_hadbrok`, tables `hb_medical_public_private` and
> `hb_group_medical_network_summary`, which is not among the files here.

Nothing below is invented. Where the legacy document recorded words instead of
a figure, the words are reproduced and flagged — the new model needs a
percentage for in/out-patient and a ceiling for the other four.

## Companies

| Company | Products |
| --- | --- |
| Arope | 3 |
| Libano Suisse | 8 |
| Royal | 3 |
| Tristar | 4 |

## Medical networks

- Full Network

Room classes recorded: Private Room

Lookup tables in the same dump hold more than these 18 rows use —
networks: Full Network, limited Network, Full Network A+, Full Network A;
rooms: Private room, Suite Room, Semi private Room, Shared Room.

## Every product at a glance

One row per legacy record. Where a company repeats a plan name, the records
differ by ANNUAL LIMIT — which is exactly what a variant is in the new model.

| # | Company | Plan | Annual limit | In-pat. | Out-pat. | Maternity | Dental | Optical | Chronic |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Arope | Elite | 600,000 | 100% | _?_ | 20,000 | 750 | 750 | _?_ |
| 2 | Arope | Prestige | 300,000 | 100% | _?_ | 7,000 | 500 | 500 | _?_ |
| 3 | Arope | Blue | 100,000 | 100% | **0** | **0** | **0** | **0** | _?_ |
| 4 | Libano Suisse | Prestige | 1,000,000 | 100% | _?_ | 20,000 | 2,000 | 2,000 | 1,000,000 |
| 5 | Libano Suisse | Prestige | 600,000 | 100% | _?_ | 20,000 | 1,000 | 1,000 | 600,000 |
| 6 | Libano Suisse | Essential | 300,000 | 100% | **0** | 7,000 | 500 | 500 | 300,000 |
| 7 | Libano Suisse | Essential | 100,000 | 100% | _?_ | 7,000 | 500 | 500 | 100,000 |
| 8 | Libano Suisse | Essential | 50,000 | 100% | _?_ | 7,000 | 500 | 500 | 50,000 |
| 9 | Libano Suisse | Classic | 100,000 | 100% | **0** | **0** | **0** | **0** | 100,000 |
| 10 | Libano Suisse | Classic | 50,000 | 100% | **0** | **0** | **0** | **0** | 50,000 |
| 11 | Libano Suisse | Classic | 25,000 | 100% | **0** | **0** | **0** | **0** | 25,000 |
| 12 | Royal | Platinum | 150,000 | 100% | _?_ | 7,000 | 1,000 | **0** | **0** |
| 13 | Royal | Golden | 100,000 | 100% | _?_ | 5,000 | 750 | **0** | **0** |
| 14 | Royal | Classic | 50,000 | 100% | _?_ | 4,000 | 500 | **0** | **0** |
| 15 | Tristar | Elite Plus | 100,000 | 100% | _?_ | 5,000 | 500 | 500 | 10000 |
| 16 | Tristar | Elite | 100,000 | 100% | _?_ | **0** | **0** | **0** | 10000 |
| 17 | Tristar | Prestige | 50,000 | 100% | _?_ | 3,000 | **0** | **0** | 5000 |
| 18 | Tristar | Blue | 30,000 | 100% | **0** | **0** | **0** | **0** | 3000 |

`0` is the plan declining the area. `_?_` is a cell the legacy document
recorded in words — listed in full under **Still to decide** below.

## Still to decide

The new model asks each core area for one figure. These cells hold words
instead, and no figure can be inferred without someone reading the policy:

| Company | Plan | Area | What the document says |
| --- | --- | --- | --- |
| Arope | Elite | Out-patient | “Covered” |
| Arope | Elite | Chronic / Pre-existing Conditions | “Covered after year” |
| Arope | Prestige | Out-patient | “Covered” |
| Arope | Prestige | Chronic / Pre-existing Conditions | “Covered after year” |
| Arope | Blue | Chronic / Pre-existing Conditions | “Covered after year” |
| Libano Suisse | Prestige | Out-patient | “Covered” |
| Libano Suisse | Prestige | Out-patient | “Covered” |
| Libano Suisse | Essential | Out-patient | “Covered” |
| Libano Suisse | Essential | Out-patient | “Covered” |
| Royal | Platinum | Out-patient | “Covered” |
| Royal | Golden | Out-patient | “Covered” |
| Royal | Classic | Out-patient | “Covered” |
| Tristar | Elite Plus | Out-patient | “Covered” |
| Tristar | Elite | Out-patient | “Covered” |
| Tristar | Prestige | Out-patient | “Covered” |

---

# Arope

## Elite  ·  annual limit 600,000 EGP

*legacy row 1 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 20,000 | — |
| Dental | LIMIT | 750 | deductible 25% |
| Optical | LIMIT | 750 | deductible 25% |
| Chronic / Pre-existing Conditions | LIMIT | — | recorded as “Covered after year” — NEEDS A FIGURE · pre-existing: “Covered after year” · chronic: “Covered after year” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Lebanon, Syria, KSA, Kuwait, Qatar,  Bahrain, Oman,Jordan, Iraq ,Palastine nd Egypt
- **Emergency Cases Outside Region**
  - Covered up to 400,000 EGP
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Up to 12 years
- **Organ Transplantation**
  - Fully Covered
- **Organ Transplantation Surgery**
  - Covered
- **Road Ambulance**
  - 700 EGP per case
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Fully Covered
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - Fully Covered
  - Deductible: 10%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Covered
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Not Covered
- **Prosthesis & Stents**
  - Not Covered
- **Hepatitis B & C**
  - Covered after year
- **New Born Baby**
  - 25 Congenital Cases  are Covered
- **Waiting Period**
  - Waiting period: 10 Months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 3,681 |
| 19–25 | 5,701 |
| 26–30 | 7,132 |
| 31–35 | 7,666 |
| 36–40 | 8,113 |
| 41–45 | 8,694 |
| 46–50 | 9,281 |
| 51–55 | 11,071 |
| 56–60 | 13,542 |
| 61–65 | 16,288 |
| 66–80 | Not Covered |

## Prestige  ·  annual limit 300,000 EGP

*legacy row 2 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 7,000 | highest of “7,000 Cesarean - 5,000 Natural - 1,500 Legal Abortion” — the rest belong in detail lines |
| Dental | LIMIT | 500 | deductible 25% |
| Optical | LIMIT | 500 | deductible 25% |
| Chronic / Pre-existing Conditions | LIMIT | — | recorded as “Covered after year” — NEEDS A FIGURE · pre-existing: “Covered after year” · chronic: “Covered after year” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Up to 12 years
- **Organ Transplantation**
  - Not Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - 12 Visit per Year
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - Fully Covered
  - Deductible: 15%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Covered
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Not Covered
- **Prosthesis & Stents**
  - Not Covered
- **Hepatitis B & C**
  - Up to 3000 after year
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 10 Months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 2,141 |
| 19–25 | 3,054 |
| 26–30 | 3,448 |
| 31–35 | 4,017 |
| 36–40 | 4,673 |
| 41–45 | 5,313 |
| 46–50 | 6,331 |
| 51–55 | 6,949 |
| 56–60 | 8,699 |
| 61–65 | 10,669 |
| 66–80 | Not Covered |

## Blue  ·  annual limit 100,000 EGP

*legacy row 3 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | 0%  (not covered) | “Not Covered” → 0 |
| Maternity | LIMIT | 0  (not covered) | “Not Covered” → 0 |
| Dental | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | — | recorded as “Covered after year” — NEEDS A FIGURE · pre-existing: “Covered after year” · chronic: “Covered after year” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Up to 12 years
- **Organ Transplantation**
  - Not Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Not Covered
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Not Covered
  - Deductible: 0%
- **Physiotherapy**
  - Not Covered
  - Deductible: 0%
- **Medicines**
  - Not Covered
  - Deductible: 0%
- **Home Care**
  - Covered
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Not Covered
- **Prosthesis & Stents**
  - Not Covered
- **Hepatitis B & C**
  - Covered after year
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 0
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 516 |
| 19–25 | 555 |
| 26–30 | 671 |
| 31–35 | 838 |
| 36–40 | 1,032 |
| 41–45 | 1,220 |
| 46–50 | 1,520 |
| 51–55 | 1,702 |
| 56–60 | 2,217 |
| 61–65 | 2,797 |
| 66–80 | Not Covered |

---

# Libano Suisse

## Prestige  ·  annual limit 1,000,000 EGP

*legacy row 4 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 20,000 | — |
| Dental | LIMIT | 2,000 | — |
| Optical | LIMIT | 2,000 | — |
| Chronic / Pre-existing Conditions | LIMIT | 1,000,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Lebanon, Syria, KSA, Kuwait, Qatar,  Bahrain, Oman,Jordan, Iraq ,Palastine nd Egypt
- **Emergency Cases Outside Region**
  - Covered up to 400,000 EGP
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Covered up to the limit if not pre-existing
- **Road Ambulance**
  - 700 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Fully Covered
- **Consultations**
  - Fully Covered
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 10%
- **Physiotherapy**
  - Fully Covered after approval
  - Deductible: 10%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - 25 Congenital Cases  are Covered
- **Waiting Period**
  - Waiting period: 20 months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 13,641 |
| 19–25 | 15,465 |
| 26–30 | 18,000 |
| 31–35 | 18,819 |
| 36–40 | 19,449 |
| 41–45 | 20,331 |
| 46–50 | 21,111 |
| 51–55 | 24,245 |
| 56–60 | 28,298 |
| 61–65 | 32,795 |
| 66–80 | Not Covered |

## Prestige  ·  annual limit 600,000 EGP

*legacy row 5 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 20,000 | — |
| Dental | LIMIT | 1,000 | — |
| Optical | LIMIT | 1,000 | — |
| Chronic / Pre-existing Conditions | LIMIT | 600,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Lebanon, Syria, KSA, Kuwait, Qatar,  Bahrain, Oman,Jordan, Iraq ,Palastine nd Egypt
- **Emergency Cases Outside Region**
  - Covered up to 400,000 EGP
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Covered up to the limit if not pre-existing
- **Road Ambulance**
  - 700 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Fully Covered
- **Consultations**
  - Fully Covered
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 10%
- **Physiotherapy**
  - Fully Covered after approval
  - Deductible: 10%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - 25 Congenital Cases  are Covered
- **Waiting Period**
  - Waiting period: 20 months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 7,419 |
| 19–25 | 8,511 |
| 26–30 | 10,058 |
| 31–35 | 10,621 |
| 36–40 | 11,086 |
| 41–45 | 11,697 |
| 46–50 | 12,302 |
| 51–55 | 14,234 |
| 56–60 | 16,869 |
| 61–65 | 19,796 |
| 66–80 | Not Covered |

## Essential  ·  annual limit 300,000 EGP

*legacy row 6 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | 0%  (not covered) | “Not Covered” → 0 |
| Maternity | LIMIT | 7,000 | highest of “7,000 Cesarean - 5,000 Natural - 1,500 Legal Abortion” — the rest belong in detail lines |
| Dental | LIMIT | 500 | deductible 25% |
| Optical | LIMIT | 500 | deductible 25% |
| Chronic / Pre-existing Conditions | LIMIT | 300,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - 12 Visit per Year
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 0%
- **Physiotherapy**
  - Fully Covered
  - Deductible: 0%
- **Medicines**
  - Covered up to 3,000
  - Deductible: 20%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 20 months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 2,279 |
| 19–24 | 3,194 |
| 25–30 | 3,621 |
| 31–35 | 4,236 |
| 36–40 | 4,945 |
| 41–45 | 5,636 |
| 46–50 | 6,737 |
| 51–55 | 7,405 |
| 56–60 | 9,297 |
| 61–65 | 11,425 |
| 66–80 | Not Covered |

## Essential  ·  annual limit 100,000 EGP

*legacy row 7 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 7,000 | highest of “7,000 Cesarean - 5,000 Natural - 1,500 Legal Abortion” — the rest belong in detail lines |
| Dental | LIMIT | 500 | deductible 25% |
| Optical | LIMIT | 500 | deductible 25% |
| Chronic / Pre-existing Conditions | LIMIT | 100,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - 12 Visit per Year
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 0%
- **Physiotherapy**
  - Fully Covered
  - Deductible: 0%
- **Medicines**
  - Covered up to 3,000
  - Deductible: 20%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 20 months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 2,141 |
| 19–24 | 3,046 |
| 25–30 | 3,441 |
| 31–35 | 4,011 |
| 36–40 | 4,668 |
| 41–45 | 5,309 |
| 46–50 | 6,329 |
| 51–55 | 6,948 |
| 56–60 | 8,702 |
| 61–65 | 10,675 |
| 66–80 | Not Covered |

## Essential  ·  annual limit 50,000 EGP

*legacy row 8 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 7,000 | highest of “7,000 Cesarean - 5,000 Natural - 1,500 Legal Abortion” — the rest belong in detail lines |
| Dental | LIMIT | 500 | deductible 25% |
| Optical | LIMIT | 500 | deductible 25% |
| Chronic / Pre-existing Conditions | LIMIT | 50,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - 12 Visit per Year
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 15%
- **Physiotherapy**
  - Fully Covered
  - Deductible: 15%
- **Medicines**
  - Covered up to 3,000
  - Deductible: 20%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 20 months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 2,099 |
| 19–24 | 3,002 |
| 25–30 | 3,387 |
| 31–35 | 3,943 |
| 36–40 | 4,585 |
| 41–45 | 5,210 |
| 46–50 | 6,207 |
| 51–55 | 6,811 |
| 56–60 | 8,523 |
| 61–65 | 10,449 |
| 66–80 | Not Covered |

## Classic  ·  annual limit 100,000 EGP

*legacy row 9 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | 0%  (not covered) | “Not Covered” → 0 |
| Maternity | LIMIT | 0  (not covered) | “Not Covered” → 0 |
| Dental | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 100,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Not Covered
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Not Covered
  - Deductible: 0%
- **Physiotherapy**
  - Fully Covered In Patient only
  - Deductible: 0%
- **Medicines**
  - Not Covered
  - Deductible: 0%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 0
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 510 |
| 19–25 | 549 |
| 26–30 | 664 |
| 31–35 | 829 |
| 36–40 | 1,021 |
| 41–45 | 1,207 |
| 46–50 | 1,504 |
| 51–55 | 1,684 |
| 56–60 | 2,195 |
| 61–65 | 2,769 |
| 66–80 | Not Covered |

## Classic  ·  annual limit 50,000 EGP

*legacy row 10 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | 0%  (not covered) | “Not Covered” → 0 |
| Maternity | LIMIT | 0  (not covered) | “Not Covered” → 0 |
| Dental | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 50,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Not Covered
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Not Covered
  - Deductible: 0%
- **Physiotherapy**
  - Fully Covered In Patient only
  - Deductible: 0%
- **Medicines**
  - Not Covered
  - Deductible: 0%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 0
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 472 |
| 19–25 | 508 |
| 26–30 | 614 |
| 31–35 | 767 |
| 36–40 | 944 |
| 41–45 | 1,117 |
| 46–50 | 1,391 |
| 51–55 | 1,558 |
| 56–60 | 2,030 |
| 61–65 | 2,561 |
| 66–80 | Not Covered |

## Classic  ·  annual limit 25,000 EGP

*legacy row 11 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | 0%  (not covered) | “Not Covered” → 0 |
| Maternity | LIMIT | 0  (not covered) | “Not Covered” → 0 |
| Dental | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 25,000 | “up to the limit” → the annual limit · pre-existing: “Not Covered” · chronic: “Covered up to the limit if not pre-existing” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Not Covered
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Covered up to the limit if not pre-existing
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - 15,000
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Not Covered
  - Deductible: 0%
- **Ambulatory Outpatient Services**
  - Not Covered
  - Deductible: 0%
- **Physiotherapy**
  - Fully Covered In Patient only
  - Deductible: 0%
- **Medicines**
  - Not Covered
  - Deductible: 0%
- **Home Care**
  - Covered up to the limit if not pre-existing
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 0
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 459 |
| 19–25 | 494 |
| 26–30 | 597 |
| 31–35 | 746 |
| 36–40 | 919 |
| 41–45 | 1,087 |
| 46–50 | 1,354 |
| 51–55 | 1,516 |
| 56–60 | 1,975 |
| 61–65 | 2,492 |
| 66–80 | Not Covered |

---

# Royal

## Platinum  ·  annual limit 150,000 EGP

*legacy row 12 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 7,000 | highest of “7,000 Cesarean - 5,000 Natural - 3,000 Legal Abortion” — the rest belong in detail lines |
| Dental | LIMIT | 1,000 | deductible 50% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 0  (not covered) | “Not Covered” → 0 · pre-existing: “Not Covered” · chronic: “Not Covered” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Egypt
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Up to 10 years
- **Organ Transplantation**
  - Not Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - Fully Covered
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - Not Covered
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Fully Covered
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - 12 Sessions
  - Deductible: 20%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Not Covered
- **Heart Procedures**
  - Not Covered
- **Cancer Treatment**
  - Not Covered
- **Prosthesis & Stents**
  - Not Covered
- **Hepatitis B & C**
  - Not Covered
- **New Born Baby**
  - 1,000
- **Waiting Period**
  - Waiting period: 10 Months
- **Reimbursement**
  - 80% according to

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–3 | 1,851 |
| 4–18 | 1,663 |
| 19–36 | 4,271 |
| 37–46 | 5,809 |
| 47–56 | 7,019 |
| 57–61 | 8,812 |
| 62–66 | 10,806 |
| 67–80 | Not Covered |

## Golden  ·  annual limit 100,000 EGP

*legacy row 13 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 5,000 | highest of “5,000 Cesarean -4,000 Natural - 3,000 Legal Abortion” — the rest belong in detail lines |
| Dental | LIMIT | 750 | deductible 50% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 0  (not covered) | “Not Covered” → 0 · pre-existing: “Not Covered” · chronic: “Not Covered” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Egypt
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Up to 10 years
- **Organ Transplantation**
  - Not Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - Fully Covered
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - Not Covered
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Fully Covered
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - 12 Sessions
  - Deductible: 20%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Not Covered
- **Heart Procedures**
  - Not Covered
- **Cancer Treatment**
  - Not Covered
- **Prosthesis & Stents**
  - Not Covered
- **Hepatitis B & C**
  - Not Covered
- **New Born Baby**
  - 1,000
- **Waiting Period**
  - Waiting period: 10 Months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–3 | 1,403 |
| 4–18 | 1,262 |
| 19–36 | 3,330 |
| 37–46 | 4,692 |
| 47–56 | 4,878 |
| 57–61 | 6,818 |
| 62–66 | 8,116 |
| 67–80 | Not Covered |

## Classic  ·  annual limit 50,000 EGP

*legacy row 14 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 4,000 | highest of “4,000 Cesarean -3,000 Natural - 2,000 Legal Abortion” — the rest belong in detail lines |
| Dental | LIMIT | 500 | deductible 50% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 0  (not covered) | “Not Covered” → 0 · pre-existing: “Not Covered” · chronic: “Not Covered” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Egypt
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Up to 10 years
- **Organ Transplantation**
  - Not Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - Fully Covered
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - Not Covered
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Fully Covered
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - 12 Sessions
  - Deductible: 20%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Not Covered
- **Heart Procedures**
  - Not Covered
- **Cancer Treatment**
  - Not Covered
- **Prosthesis & Stents**
  - Not Covered
- **Hepatitis B & C**
  - Not Covered
- **New Born Baby**
  - 1,000
- **Waiting Period**
  - Waiting period: 10 Months
- **Reimbursement**
  - 80% according to Cleopatra

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–3 | 1,072 |
| 4–18 | 983 |
| 19–36 | 2,421 |
| 37–46 | 3,439 |
| 47–56 | 3,966 |
| 57–61 | 5,117 |
| 62–66 | 6,437 |
| 67–80 | Not Covered |

---

# Tristar

## Elite Plus  ·  annual limit 100,000 EGP

*legacy row 15 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 5,000 | — |
| Dental | LIMIT | 500 | deductible 20% |
| Optical | LIMIT | 500 | deductible 20% |
| Chronic / Pre-existing Conditions | LIMIT | 10000 | read from “covred up to  10000” · pre-existing: “covred up to 10,000” · chronic: “covred up to  10000” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Egypt
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Fully Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 700 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - Not Covered
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Fully Covered
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - Fully Covered
  - Deductible: 20%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Covered
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 10 Months
- **Reimbursement**
  - 80% according to Masr International

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 2,591 |
| 19–20 | 2,732 |
| 21–25 | 5,464 |
| 26–30 | 6,050 |
| 31–35 | 7,001 |
| 36–40 | 7,320 |
| 41–45 | 8,520 |
| 46–50 | 9,668 |
| 51–55 | 10,820 |
| 56–60 | 13,120 |
| 61–65 | 15,980 |
| 66–70 | 18,230 |
| 71–75 | 20,024 |
| 76–80 | 29,412 |

## Elite  ·  annual limit 100,000 EGP

*legacy row 16 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 0  (not covered) | “Not Covered” → 0 |
| Dental | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 10000 | read from “covred up to 10000” · pre-existing: “covred up to  10000” · chronic: “covred up to 10000” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Egypt
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Fully Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 700 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - Not Covered
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Fully Covered
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - 24 Sessions
  - Deductible: 20%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Covered
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 0
- **Reimbursement**
  - 80% according to Masr International

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 2,591 |
| 19–25 | 2,732 |
| 26–30 | 3,012 |
| 31–35 | 3,432 |
| 36–40 | 3,713 |
| 41–45 | 4,273 |
| 46–50 | 4,834 |
| 51–55 | 5,394 |
| 56–60 | 6,518 |
| 61–65 | 7,919 |
| 66–70 | 9,323 |
| 71–75 | 12,129 |
| 76–80 | 17,737 |

## Prestige  ·  annual limit 50,000 EGP

*legacy row 17 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | — | recorded as “Covered” — NEEDS A PERCENTAGE |
| Maternity | LIMIT | 3,000 | — |
| Dental | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 5000 | read from “covred up to  5000” · pre-existing: “covred up to  5000” · chronic: “covred up to  5000” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Egypt
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Not Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - Not Covered
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - 12 Visit per Year
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - Fully Covered
  - Deductible: 20%
- **Physiotherapy**
  - 24 Sessions
  - Deductible: 20%
- **Medicines**
  - Fully Covered
  - Deductible: 20%
- **Home Care**
  - Covered
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 10 Months
- **Reimbursement**
  - 80% according to Masr International

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 1,769 |
| 19–25 | 1,865 |
| 26–30 | 2,057 |
| 31–35 | 2,345 |
| 36–40 | 2,538 |
| 41–45 | 2,922 |
| 46–50 | 3,307 |
| 51–55 | 3,691 |
| 56–60 | 4,462 |
| 61–65 | 5,423 |
| 66–70 | 6,386 |
| 71–75 | 8,310 |
| 76–80 | 12,157 |

## Blue  ·  annual limit 30,000 EGP

*legacy row 18 · network: Full Network · class: Private Room*

### Core benefits

| Area | Kind | Recorded value | Notes |
| --- | --- | --- | --- |
| In-patient | PERCENTAGE | 100% | “Fully Covered” → 100% |
| Out-patient | PERCENTAGE | 0%  (not covered) | “Not Covered” → 0 |
| Maternity | LIMIT | 0  (not covered) | “Not Covered” → 0 |
| Dental | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Optical | LIMIT | 0  (not covered) | “Not Covered” → 0 · deductible 0% |
| Chronic / Pre-existing Conditions | LIMIT | 3000 | read from “covred up to  3000” · pre-existing: “covred up to  3000” · chronic: “covred up to  3000” |

### Additional benefits

- **Room Type**
  - Private Room
- **Medical Network**
  - Full Network
- **Area Coverage**
  - Egypt
- **Emergency Cases Outside Region**
  - Not Covered
- **Emergency Medical Treatment Outside Egypt**
  - Not Covered
- **Accompanying Family Member**
  - Not Covered
- **Organ Transplantation**
  - Not Covered
- **Organ Transplantation Surgery**
  - Not Covered
- **Road Ambulance**
  - 600 EGP per case
- **Work Related Accidents**
  - Covered up to the limit if not pre-existing
- **Morgue / Last Expenses**
  - Not Covered
- **Personal Accident**
  - Not Covered
- **Expert Second Medical Opinion**
  - Not Covered
- **Consultations**
  - Not Covered
  - Deductible: 20%
- **Ambulatory Outpatient Services**
  - 15,000
  - Deductible: 20%
- **Physiotherapy**
  - 12 Sessions
  - Deductible: 20%
- **Medicines**
  - 10,000
  - Deductible: 20%
- **Home Care**
  - Covered
- **Heart Procedures**
  - Covered up to the limit if not pre-existing
- **Cancer Treatment**
  - Covered up to the limit if not pre-existing
- **Prosthesis & Stents**
  - Covered up to the limit if not pre-existing
- **Hepatitis B & C**
  - Covered up to the limit if not pre-existing
- **New Born Baby**
  - Not Covered
- **Waiting Period**
  - Waiting period: 0
- **Reimbursement**
  - 80% according to Masr International

### Price by age

| Ages | Annual premium |
| --- | --- |
| 1–18 | 1,597 |
| 19–25 | 1,677 |
| 26–30 | 1,836 |
| 31–35 | 2,076 |
| 36–40 | 2,236 |
| 41–45 | 2,555 |
| 46–50 | 2,875 |
| 51–55 | 3,194 |
| 56–60 | 3,834 |
| 61–65 | 4,633 |
| 66–70 | 5,433 |
| 71–75 | 7,031 |
| 76–80 | 10,227 |
