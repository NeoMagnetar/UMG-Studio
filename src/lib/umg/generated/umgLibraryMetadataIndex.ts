// GENERATED READ-ONLY METADATA INDEX. Source: /home/neomagnetar/umg-block-library
// Do not edit by hand. Regenerate with scripts/buildUmgLibraryMetadataIndex.mjs.
import rawIndex from './umgLibraryMetadataIndex.json';
import type { UmgLibraryCandidateBase } from '../umgLibraryCandidateRetrieval';

const typedIndex = rawIndex as { info: { generatedAt: string; sourceRoot: string; filesScanned: number; candidateCount: number; counts: Record<string, number>; libraryEntryFiles: number; unsupportedSchemas: number; fieldsExtracted: string[] }; candidates: UmgLibraryCandidateBase[] };

export const UMG_LIBRARY_METADATA_INDEX_INFO = typedIndex.info;
export const UMG_LIBRARY_METADATA_INDEX = typedIndex.candidates;
