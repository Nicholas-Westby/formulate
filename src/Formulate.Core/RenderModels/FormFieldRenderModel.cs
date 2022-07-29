﻿namespace Formulate.Website.RenderModels
{
    using Formulate.Core.FormFields;

    public sealed class FormFieldRenderModel : IFormFieldFeatures
    {
        private readonly IFormFieldFeatures _features;

        public FormFieldRenderModel(IFormFieldFeatures features, IFormField field)
        {
            _features = features;
            Field = field;
        }

        public IFormField Field { get; init; }

        public bool IsTransitory => _features.IsTransitory;

        public bool IsServerSideOnly => _features.IsServerSideOnly;

        public bool IsHidden => _features.IsHidden;

        public bool IsStored => _features.IsStored;
    }
}