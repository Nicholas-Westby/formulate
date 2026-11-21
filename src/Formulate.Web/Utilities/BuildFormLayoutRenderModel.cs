namespace Formulate.Web.Utilities
{
    using Formulate.Core;
    using Formulate.Core.FormFields;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.RenderModels;
    using Formulate.Web.RenderModels;
    using Microsoft.Extensions.Logging;

    public sealed class BuildFormLayoutRenderModel : IBuildFormLayoutRenderModel
    {
        private readonly IFormEntityRepository _formEntityRepository;
        private readonly IFormFieldFactory _formFieldFactory;
        private readonly FormFieldDefinitionCollection _formFieldDefinitions;

        private readonly ILayoutEntityRepository _layoutEntityRepository;
        private readonly ILayoutFactory _layoutFactory;
        private readonly ILogger<BuildFormLayoutRenderModel> _logger;

        public BuildFormLayoutRenderModel(IFormEntityRepository formEntityRepository, IFormFieldFactory formFieldFactory, FormFieldDefinitionCollection formFieldDefinitions, ILayoutEntityRepository layoutEntityRepository, ILayoutFactory layoutFactory, ILogger<BuildFormLayoutRenderModel> logger)
        {
            _logger = logger;
            _formEntityRepository = formEntityRepository;
            _formFieldFactory = formFieldFactory;
            _formFieldDefinitions = formFieldDefinitions;

            _layoutEntityRepository = layoutEntityRepository;
            _layoutFactory = layoutFactory;
        }

        public FormLayoutRenderModel? Build(FormLayout formLayout)
        {
            var form = BuildForm(formLayout.FormId);
            var layout = BuildLayout(formLayout.LayoutId);
            
            if (form is null || layout is null)
            {
                return default;
            }

            return new FormLayoutRenderModel(form, layout);
        }

        private ILayout? BuildLayout(Guid layoutId)
        {
            var layout = _layoutEntityRepository.Get(layoutId);

            if (layout is null)
            {
                return default;
            }

            return _layoutFactory.Create(layout);
        }

        public FormRenderModel? BuildForm(Guid formId)
        {
            var form = _formEntityRepository.Get(formId);

            if (form is null)
            {
                return default;
            }

            var formFieldRenderModels = new List<FormFieldRenderModel>();

            foreach (var field in form.Fields)
            {
                var createdField = _formFieldFactory.Create(field);

                if (createdField is null)
                {
                    _logger.LogWarning(
                        "Skipping field {FieldId} on form {FormId} because its kind {FieldKindId} is not installed.",
                        field.Id, form.Id, field.KindId);
                    continue;
                }

                var fieldDefinition = _formFieldDefinitions.FirstOrDefault(x => x.KindId == createdField.KindId);

                if (fieldDefinition is null)
                {
                    _logger.LogWarning(
                        "Skipping field {FieldId} on form {FormId} because it has no definition for kind {FieldKindId}.",
                        field.Id, form.Id, createdField.KindId);
                    continue;
                }

                formFieldRenderModels.Add(new FormFieldRenderModel(fieldDefinition, createdField));
            }

            if (formFieldRenderModels.Any() == false)
            {
                return default;
            }

            return new FormRenderModel(form.Id, form.Name, form.Alias)
            {
                Fields = formFieldRenderModels
            };
        }
    }
}
