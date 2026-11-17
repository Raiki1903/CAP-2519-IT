/**
 * Asset tag numbering: computes the next sequential tag for a lab based on its short code and existing tags.
 * Layer: shared service. Called by features/assets/assets.service.ts and features/imports/imports.repository.ts.
 * Calls: nothing.
 * Used by: asset registration and bulk asset import.
 */

/**
 * The next tag of a lab: its prefix and one more than the highest number its tags have, four digits.
 *
 * @param labPrefix the lab's short code
 * @param existingTags the tags the lab's assets currently have
 * @returns for example "CeLT-0005" after "CeLT-0004"
 */
export function nextTagOf(labPrefix: string, existingTags: string[]): string {
    let maxSeq = 0;
    const prefixPattern = new RegExp(`^${labPrefix}-(\\d+)$`, "i");
    for (const tag of existingTags) {
        const match = tag.match(prefixPattern);
        if (match) {
            const seq = parseInt(match[1], 10);
            if (seq > maxSeq) maxSeq = seq;
        }
    }
    return `${labPrefix}-${String(maxSeq + 1).padStart(4, "0")}`;
}

