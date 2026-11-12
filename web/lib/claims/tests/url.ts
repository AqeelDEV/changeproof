// The claim carried from the globe to the detailed map in the page address.
//
//   node web/lib/claims/tests/url.ts
import assert from "node:assert/strict";
import { claimParam } from "../../claimParam.ts";

let n = 0;
const is = (got: unknown, want: unknown, label: string) => { assert.equal(got, want, label); n++; };

is(claimParam(""), null, "no query");
is(claimParam("?area=aoi01"), null, "no claim in the query");
is(claimParam("?claim="), null, "empty claim");
is(claimParam("?claim=%20%20"), null, "only spaces");
is(claimParam("?claim=Maputo+was+flooded"), "Maputo was flooded", "plus signs are spaces");
is(claimParam("?claim=" + encodeURIComponent("  Chókwè was under water on 17 January ")), "Chókwè was under water on 17 January", "accents survive, spaces are trimmed");
is(claimParam("?x=1&claim=a%26b&y=2"), "a&b", "an encoded ampersand stays in the claim");
is(claimParam("?claim=" + "a".repeat(400))?.length, 300, "cut to the input's 300 characters");
is(claimParam("?claim=first&claim=second"), "first", "the first claim wins");

console.log(`${n} of ${n} address checks pass.`);
