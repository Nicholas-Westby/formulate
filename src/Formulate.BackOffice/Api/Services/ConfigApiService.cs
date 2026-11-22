namespace Formulate.BackOffice.Api.Services
{
    using System.Linq;
    using Formulate.BackOffice.Api.Models.Config;
    using Formulate.BackOffice.Configuration;
    using Microsoft.Extensions.Options;

    /// <summary>
    /// The default implementation of <see cref="IConfigApiService"/>.
    /// </summary>
    public sealed class ConfigApiService : IConfigApiService
    {
        private readonly IOptions<ButtonsOptions> _buttons;

        private readonly IOptions<FormFieldOptions> _fields;

        private readonly IOptions<FormulateBackOfficeOptions> _backOffice;

        /// <inheritdoc cref="ConfigApiService"/>
        public ConfigApiService(
            IOptions<ButtonsOptions> buttons,
            IOptions<FormFieldOptions> fields,
            IOptions<FormulateBackOfficeOptions> backOffice)
        {
            _buttons = buttons;
            _fields = fields;
            _backOffice = backOffice;
        }

        /// <inheritdoc />
        public FormulateConfigResponseModel Get()
        {
            return new FormulateConfigResponseModel
            {
                ButtonKinds = _buttons.Value.Select(button => button.Kind).ToArray(),
                FieldCategories = _fields.Value.Categories
                    .Select(category => new FieldCategoryModel { Group = category.Group, Kind = category.Kind })
                    .ToArray(),
                UseDefaultFolderIcon = _backOffice.Value.UseDefaultFolderIcon,
            };
        }
    }
}
