import { useState, useCallback } from "react";

export const useForm = (initialValues = {}, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((name, value) => {
    const rule = validationRules[name];
    if (!rule) return "";

    if (rule.required && (!value || (typeof value === "string" && !value.trim()))) {
      return rule.message || `${name} is required`;
    }
    if (rule.minLength && value.length < rule.minLength) {
      return `Minimum ${rule.minLength} characters`;
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      return `Maximum ${rule.maxLength} characters`;
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return rule.message || `Invalid format`;
    }
    if (rule.min !== undefined && Number(value) < rule.min) {
      return `Minimum value is ${rule.min}`;
    }
    if (rule.max !== undefined && Number(value) > rule.max) {
      return `Maximum value is ${rule.max}`;
    }
    if (rule.custom) {
      return rule.custom(value, values);
    }
    return "";
  }, [validationRules, values]);

  const validateAll = useCallback(() => {
    const newErrors = {};
    let isValid = true;
    for (const [name] of Object.entries(validationRules)) {
      const error = validate(name, values[name] || "");
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    }
    setErrors(newErrors);
    return isValid;
  }, [validate, validationRules, values]);

  const handleChange = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      const error = validate(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validate]);

  const handleBlur = useCallback((name) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validate(name, values[name] || "");
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [validate, values]);

  const handleSubmit = useCallback((onSubmit) => {
    return async (e) => {
      e?.preventDefault();
      setIsSubmitting(true);
      const allTouched = {};
      for (const name of Object.keys(validationRules)) {
        allTouched[name] = true;
      }
      setTouched(allTouched);

      if (validateAll()) {
        try {
          await onSubmit(values);
        } catch (err) {
          console.error("Form submit error:", err);
        }
      }
      setIsSubmitting(false);
    };
  }, [validateAll, validationRules, values]);

  const reset = useCallback((newValues) => {
    setValues(newValues || initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values, errors, touched, isSubmitting,
    handleChange, handleBlur, handleSubmit, validateAll, reset,
  };
};
