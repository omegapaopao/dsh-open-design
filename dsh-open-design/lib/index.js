import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export const name = 'dsh-open-design';
export const PACKAGE_NAME = 'dsh-open-design';

/**
 * Resolve the packaged OpenDesign skill root from the DSH profile.
 * @param {string} profileBaseUrl - the Loader baseUrl of the owning profile.
 * @returns {string} absolute path of the bundled skills directory.
 */
export function resolveOpenDesignSkillRoot(profileBaseUrl) {
  if (!profileBaseUrl) {
    throw new Error('dsh-open-design: missing DSH profile baseUrl for package resolution');
  }
  let manifestPath;
  try {
    manifestPath = createRequire(profileBaseUrl).resolve(`${PACKAGE_NAME}/package.json`);
  } catch (error) {
    throw new Error(
      `dsh-open-design: cannot resolve ${PACKAGE_NAME}/package.json from the DSH profile`,
      { cause: error },
    );
  }
  return join(dirname(manifestPath), 'skills');
}
