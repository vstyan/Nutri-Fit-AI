// scripts/patch-capgo.cjs
// Makes checksum requirement optional in Capgo Capacitor Updater Android native plugin
const fs = require('fs');
const path = require('path');

// Locate project root whether invoked from scripts/ or .agents/scripts/
let projectRoot = process.cwd();
if (!fs.existsSync(path.join(projectRoot, 'node_modules'))) {
  projectRoot = path.resolve(__dirname, '../..');
}
if (!fs.existsSync(path.join(projectRoot, 'node_modules'))) {
  projectRoot = path.resolve(__dirname, '..');
}

const pluginFile = path.resolve(projectRoot, 'node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/CapacitorUpdaterPlugin.java');
const updaterFile = path.resolve(projectRoot, 'node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/CapgoUpdater.java');
const downloadServiceFile = path.resolve(projectRoot, 'node_modules/@capgo/capacitor-updater/android/src/main/java/ee/forgr/capacitor_updater/DownloadService.java');

function patchFile(filePath, searchStr, replaceStr) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-capgo] File not found: ${filePath}, skipping`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(searchStr)) {
    content = content.replace(searchStr, replaceStr);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[patch-capgo] Successfully patched ${path.basename(filePath)}`);
  } else {
    console.log(`[patch-capgo] Target string not found in ${path.basename(filePath)} (already patched or different version)`);
  }
}

// 1. Patch CapacitorUpdaterPlugin.java
patchFile(
  pluginFile,
  `        if (manifest == null && (checksum == null || checksum.isEmpty())) {
            logger.error("No checksum provided");
            this.implementation.sendStats("checksum_required");
            throw new IOException("Checksum required");
        }`,
  `        if (manifest == null && (checksum == null || checksum.isEmpty())) {
            logger.warn("No checksum provided, proceeding without strict checksum requirement");
        }`
);

// 2. Patch CapgoUpdater.java requireBundleChecksum
patchFile(
  updaterFile,
  `    private void requireBundleChecksum(final String checksum) throws IOException {
        if (checksum == null || checksum.isEmpty()) {
            logger.error("No checksum provided");
            this.sendStats("checksum_required");
            throw new IOException("Checksum required");
        }
    }`,
  `    private void requireBundleChecksum(final String checksum) throws IOException {
        if (checksum == null || checksum.isEmpty()) {
            logger.warn("No checksum provided - skipping bundle checksum requirement");
            return;
        }
    }`
);

// 3. Patch CapgoUpdater.java finishDownload checksum check
patchFile(
  updaterFile,
  `            if (!isManifest) {
                String expectedChecksum = Objects.requireNonNullElse(checksumRes, "");
                this.requireBundleChecksum(expectedChecksum);

                if (CryptoCipher.isValidSessionKey(sessionKey)) {
                    CryptoCipher.decryptFile(downloaded, publicKey, sessionKey);
                    expectedChecksum = CryptoCipher.decryptChecksum(checksumRes, publicKey);
                }
                checksum = CryptoCipher.calcChecksum(downloaded);
                CryptoCipher.logChecksumInfo("Calculated checksum", checksum);
                CryptoCipher.logChecksumInfo("Expected checksum", expectedChecksum);
                if (!expectedChecksum.equals(checksum)) {
                    logger.error("Checksum mismatch");
                    logger.debug("Expected: " + expectedChecksum + ", Got: " + checksum);
                    this.sendStats("checksum_fail");
                    throw new IOException("Checksum failed: " + id);
                }
            }`,
  `            if (!isManifest) {
                String expectedChecksum = Objects.requireNonNullElse(checksumRes, "");
                if (expectedChecksum != null && !expectedChecksum.isEmpty()) {
                    if (CryptoCipher.isValidSessionKey(sessionKey)) {
                        CryptoCipher.decryptFile(downloaded, publicKey, sessionKey);
                        expectedChecksum = CryptoCipher.decryptChecksum(checksumRes, publicKey);
                    }
                    checksum = CryptoCipher.calcChecksum(downloaded);
                    CryptoCipher.logChecksumInfo("Calculated checksum", checksum);
                    CryptoCipher.logChecksumInfo("Expected checksum", expectedChecksum);
                    if (!expectedChecksum.equals(checksum)) {
                        logger.error("Checksum mismatch");
                        logger.debug("Expected: " + expectedChecksum + ", Got: " + checksum);
                        this.sendStats("checksum_fail");
                        throw new IOException("Checksum failed: " + id);
                    }
                } else {
                    logger.warn("No checksum provided for bundle, skipping checksum validation");
                }
            }`
);

// 4. Patch DownloadService.java
patchFile(
  downloadServiceFile,
  `        if (checksum == null || checksum.isEmpty()) {
            logger.error("No checksum provided");
            sendStatsAsync("checksum_required", version);
            throw new RuntimeException("Checksum required");
        }`,
  `        if (checksum == null || checksum.isEmpty()) {
            logger.warn("No checksum provided in DownloadService, proceeding with download");
        }`
);

// 5. Patch HealthManager.kt in @capgo/capacitor-health to support TOTAL_CALORIES in queryAggregated
const healthManagerFile = path.resolve(projectRoot, 'node_modules/@capgo/capacitor-health/android/src/main/java/app/capgo/plugin/health/HealthManager.kt');
patchFile(
  healthManagerFile,
  `        val supportedAggregations = when (dataType) {
            HealthDataType.STEPS,
            HealthDataType.DISTANCE,
            HealthDataType.CALORIES,
            HealthDataType.HYDRATION,
            HealthDataType.DIETARY_ENERGY -> setOf("sum")`,
  `        val supportedAggregations = when (dataType) {
            HealthDataType.STEPS,
            HealthDataType.DISTANCE,
            HealthDataType.CALORIES,
            HealthDataType.TOTAL_CALORIES,
            HealthDataType.HYDRATION,
            HealthDataType.DIETARY_ENERGY -> setOf("sum")`
);

patchFile(
  healthManagerFile,
  `        HealthDataType.CALORIES -> setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
        HealthDataType.HEART_RATE -> setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MAX, HeartRateRecord.BPM_MIN)`,
  `        HealthDataType.CALORIES -> setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL)
        HealthDataType.TOTAL_CALORIES -> setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL)
        HealthDataType.HEART_RATE -> setOf(HeartRateRecord.BPM_AVG, HeartRateRecord.BPM_MAX, HeartRateRecord.BPM_MIN)`
);

patchFile(
  healthManagerFile,
  `            HealthDataType.CALORIES -> result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
            HealthDataType.HEART_RATE -> when (aggregation) {`,
  `            HealthDataType.CALORIES -> result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories
            HealthDataType.TOTAL_CALORIES -> result[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories
            HealthDataType.HEART_RATE -> when (aggregation) {`
);
