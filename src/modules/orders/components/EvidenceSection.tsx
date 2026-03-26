import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette } from '../../../shared/theme/palette';
import { typography } from '../../../shared/theme/typography';
import { formatEvidenceSize, formatEvidenceExpiry } from '../utils/evidence';
import { PedidoAdjuntoUploadAsset, PedidoEvidenciaItem } from '../types';

type EvidenceSectionProps = {
  title?: string;
  canView: boolean;
  canManage: boolean;
  evidences: PedidoEvidenciaItem[];
  pendingFiles?: PedidoAdjuntoUploadAsset[];
  evidenceMaxFileSizeLabel?: string | null;
  onAddFiles?: () => void;
  onRemovePendingFile?: (fileKey: string) => void;
  onUploadPendingFiles?: () => void;
  uploadButtonLabel?: string;
  uploading?: boolean;
  onPreviewEvidence: (item: PedidoEvidenciaItem) => void;
  onDownloadEvidence: (item: PedidoEvidenciaItem) => void;
};

export function EvidenceSection({
  title = 'EVIDENCIA',
  canView,
  canManage,
  evidences,
  pendingFiles = [],
  evidenceMaxFileSizeLabel,
  onAddFiles,
  onRemovePendingFile,
  onUploadPendingFiles,
  uploadButtonLabel = 'Subir evidencia',
  uploading = false,
  onPreviewEvidence,
  onDownloadEvidence,
}: EvidenceSectionProps) {
  const shouldRender = canView || canManage || pendingFiles.length > 0;
  if (!shouldRender) {
    return null;
  }

  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {canManage ? (
        <View style={styles.helperBlock}>
          <Text style={styles.helperText}>
            {evidenceMaxFileSizeLabel
              ? `Puedes cargar JPG, PNG o PDF. Tamaño máximo por archivo: ${evidenceMaxFileSizeLabel}.`
              : 'Puedes cargar JPG, PNG o PDF.'}
          </Text>
          <Text style={styles.helperText}>
            La evidencia solo puede ser vista por el vendedor que capturó el pedido y CXC.
          </Text>
          {onAddFiles ? (
            <Pressable style={styles.secondaryButton} onPress={onAddFiles} disabled={uploading}>
              <Text style={styles.secondaryButtonLabel}>Agregar evidencia</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {pendingFiles.length > 0 ? (
        <View style={styles.pendingBlock}>
          <Text style={styles.blockLabel}>Archivos pendientes</Text>
          {pendingFiles.map((file) => (
            <View key={`${file.uri}-${file.name}`} style={styles.fileRow}>
              <View style={styles.fileInfo}>
                <Text style={styles.fileName}>{file.name}</Text>
                <Text style={styles.fileMeta}>
                  {formatEvidenceSize(file.size)}{file.mimeType ? ` · ${file.mimeType}` : ''}
                </Text>
              </View>
              {onRemovePendingFile ? (
                <Pressable
                  style={styles.removeButton}
                  onPress={() => onRemovePendingFile(file.uri)}
                  disabled={uploading}
                >
                  <Text style={styles.removeButtonLabel}>Quitar</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {onUploadPendingFiles ? (
            <Pressable style={styles.primaryButton} onPress={onUploadPendingFiles} disabled={uploading}>
              <Text style={styles.primaryButtonLabel}>{uploading ? 'Subiendo...' : uploadButtonLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {canView ? (
        <View style={styles.listBlock}>
          {evidences.length > 0 ? (
            evidences.map((item) => (
              <View key={item.id} style={styles.fileRow}>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName}>{item.nombre_original}</Text>
                  <Text style={styles.fileMeta}>
                    {formatEvidenceSize(item.tamano_bytes)}
                    {item.extension ? ` · ${String(item.extension).toUpperCase()}` : ''}
                    {item.expira_at ? ` · expira ${formatEvidenceExpiry(item.expira_at)}` : ''}
                  </Text>
                </View>
                <View style={styles.actionsWrap}>
                  {item.previewable ? (
                    <Pressable style={styles.smallButton} onPress={() => onPreviewEvidence(item)}>
                      <Text style={styles.smallButtonLabel}>Ver</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.smallButtonAlt} onPress={() => onDownloadEvidence(item)}>
                    <Text style={styles.smallButtonAltLabel}>Descargar</Text>
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>Aún no hay evidencia cargada para este pedido.</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 15,
    marginBottom: 10,
  },
  helperBlock: {
    marginBottom: 10,
  },
  helperText: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  pendingBlock: {
    borderTopWidth: 1,
    borderTopColor: '#edf2f6',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  listBlock: {
    borderTopWidth: 1,
    borderTopColor: '#edf2f6',
    paddingTop: 10,
    marginTop: 4,
  },
  blockLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 13,
    marginBottom: 8,
  },
  fileRow: {
    borderWidth: 1,
    borderColor: '#dfe7ef',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    backgroundColor: '#fbfcfd',
  },
  fileInfo: {
    flexShrink: 1,
    marginBottom: 8,
  },
  fileName: {
    color: palette.text,
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  fileMeta: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 11,
    marginTop: 2,
  },
  actionsWrap: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  secondaryButton: {
    backgroundColor: palette.navy,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 13,
  },
  smallButton: {
    backgroundColor: palette.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  smallButtonLabel: {
    color: '#fff',
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  smallButtonAlt: {
    backgroundColor: '#ecf2f8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d2dce8',
  },
  smallButtonAltLabel: {
    color: palette.navy,
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  removeButton: {
    backgroundColor: '#fde8e8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#f6bcbc',
  },
  removeButtonLabel: {
    color: '#b42318',
    fontFamily: typography.semiBold,
    fontSize: 12,
  },
  emptyText: {
    color: palette.mutedText,
    fontFamily: typography.regular,
    fontSize: 12,
  },
});
