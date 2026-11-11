import { useMemo, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Modal } from '../../components/Modal';
import { RichTextEditor } from '../../components/RichTextEditor';
import { ComponentSaveError } from './api';
import { TypeSelect } from './TypeSelect';
import {
  EMPTY_FORM, INTERVENTION_LABELS, INTERVENTION_TYPES, toFormValues,
  type ComponentField, type ComponentFormValues, type ComponentTypeRef, type TaskComponent,
} from './types';
import { hasErrors, isDirty, MAX_NAME, MAX_NOTE, validateComponentForm, type FieldErrors } from './validation';

interface ComponentFormModalProps {
  types: ComponentTypeRef[];
  existing: TaskComponent[];
  editing?: TaskComponent | null;
  onSubmit: (values: ComponentFormValues) => Promise<void>;
  onClose: () => void;
}

export function ComponentFormModal({ types, existing, editing, onSubmit, onClose }: ComponentFormModalProps) {
  const initial = useMemo(() => (editing ? toFormValues(editing) : EMPTY_FORM), [editing]);
  const [values, setValues] = useState<ComponentFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Si el registro editado usa un tipo ya inactivo, se agrega a la lista para mostrarlo.
  const typeOptions = useMemo(() => {
    if (editing && !types.some((t) => t.id === editing.component_type_id)) {
      return [...types, editing.component_type];
    }
    return types;
  }, [types, editing]);

  const selectedType = typeOptions.find((t) => t.id === values.component_type_id);
  const dirty = isDirty(values, initial);

  const set = <K extends ComponentField>(key: K, value: ComponentFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const requestClose = () => {
    if (dirty && !saving) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const v = validateComponentForm(values, typeOptions, existing, editing?.id);
    setErrors(v);
    if (hasErrors(v)) {
      const first = (Object.keys(v) as ComponentField[]).find((k) => v[k]);
      if (first) document.getElementById(`cf-${first}`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...values, component_name: values.component_name.trim() });
    } catch (err) {
      if (err instanceof ComponentSaveError) {
        setErrors(err.mapped.fieldErrors);
        setFormError(err.mapped.formError ?? null);
      } else {
        setFormError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const errId = (f: ComponentField) => (errors[f] ? `cf-${f}-error` : undefined);
  const fieldError = (f: ComponentField) =>
    errors[f] ? (
      <p className="field-error" id={`cf-${f}-error`} role="alert">
        {errors[f]}
      </p>
    ) : null;

  return (
    <>
      <Modal
        title={editing ? 'Editar componente' : 'Agregar componente'}
        onClose={requestClose}
        size="lg"
        footer={
          <>
            <button type="button" className="btn" onClick={requestClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" form="component-form" className="btn btn--primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <form id="component-form" className="form" onSubmit={submit} noValidate>
          {formError && (
            <div className="callout callout--error" role="alert">
              {formError}
            </div>
          )}

          <div className="field">
            <label htmlFor="cf-component_type_id">Tipo de componente *</label>
            <TypeSelect
              id="cf-component_type_id"
              types={typeOptions}
              value={values.component_type_id}
              onChange={(id) => set('component_type_id', id)}
              invalid={!!errors.component_type_id}
              describedBy={errId('component_type_id')}
            />
            {fieldError('component_type_id')}
          </div>

          {selectedType?.requires_note && (
            <div className="field">
              <label htmlFor="cf-other_type_note">Especificar tipo *</label>
              <input
                id="cf-other_type_note"
                className="input"
                maxLength={MAX_NOTE}
                value={values.other_type_note}
                onChange={(e) => set('other_type_note', e.target.value)}
                aria-invalid={!!errors.other_type_note || undefined}
                aria-describedby={errId('other_type_note')}
                aria-required="true"
                placeholder="Ej.: Einstein Bot, Omni-Channel Routing…"
              />
              {fieldError('other_type_note')}
            </div>
          )}

          <div className="field">
            <label htmlFor="cf-component_name">Nombre (API Name) *</label>
            <input
              id="cf-component_name"
              className="input mono"
              maxLength={MAX_NAME + 20}
              value={values.component_name}
              onChange={(e) => set('component_name', e.target.value)}
              onBlur={(e) => set('component_name', e.target.value.trim())}
              aria-invalid={!!errors.component_name || undefined}
              aria-describedby={errId('component_name')}
              aria-required="true"
              autoComplete="off"
              spellCheck={false}
              placeholder="Ej.: PortalEmpresa, AccountTriggerHandler"
            />
            {fieldError('component_name')}
          </div>

          <fieldset className="field">
            <legend>Tipo de intervención *</legend>
            <div
              className="segmented"
              role="radiogroup"
              aria-describedby={errId('intervention_type')}
              aria-invalid={!!errors.intervention_type || undefined}
            >
              {INTERVENTION_TYPES.map((it, i) => (
                <label key={it} className={`segmented__option segmented__option--${it}`}>
                  <input
                    type="radio"
                    name="intervention_type"
                    id={i === 0 ? 'cf-intervention_type' : undefined}
                    value={it}
                    checked={values.intervention_type === it}
                    onChange={() => set('intervention_type', it)}
                  />
                  <span>{INTERVENTION_LABELS[it]}</span>
                </label>
              ))}
            </div>
            {fieldError('intervention_type')}
          </fieldset>

          <div className="field">
            <label htmlFor="cf-work_detail" id="cf-work_detail-label">
              Detalle del trabajo realizado *
            </label>
            <RichTextEditor
              id="cf-work_detail"
              value={values.work_detail}
              onChange={(html) => set('work_detail', html)}
              invalid={!!errors.work_detail}
              describedBy={errId('work_detail')}
              ariaLabel="Detalle del trabajo realizado"
            />
            {fieldError('work_detail')}
          </div>
        </form>
      </Modal>

      {confirmDiscard && (
        <ConfirmDialog
          title="Descartar cambios"
          message="Tienes cambios sin guardar. ¿Deseas descartarlos?"
          confirmLabel="Descartar"
          cancelLabel="Seguir editando"
          danger
          onConfirm={() => {
            setConfirmDiscard(false);
            onClose();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
    </>
  );
}
