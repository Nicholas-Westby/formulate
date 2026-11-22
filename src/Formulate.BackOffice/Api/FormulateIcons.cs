namespace Formulate.BackOffice.Api
{
    using System;

    /// <summary>
    /// Chooses the icon the back office shows for a Formulate entity.
    /// </summary>
    /// <remarks>
    /// Formulate's old icon font is not used any more, so every icon here is one of Umbraco's built-in
    /// names. A definition's own icon (data values) is used only when it is a built-in name too: a name
    /// that does not start with <c>icon-</c>, or that is one of the old <c>icon-formulate-*</c> names,
    /// falls back to the default for the entity type.
    /// </remarks>
    public static class FormulateIcons
    {
        private const string BuiltInPrefix = "icon-";

        private const string LegacyPrefix = "icon-formulate-";

        /// <summary>
        /// The icon for folders in every tree.
        /// </summary>
        public const string Folder = "icon-folder";

        /// <summary>
        /// The icon for forms.
        /// </summary>
        public const string Form = "icon-document";

        /// <summary>
        /// The icon for layouts.
        /// </summary>
        public const string Layout = "icon-layout";

        /// <summary>
        /// The icon for validations.
        /// </summary>
        public const string Validation = "icon-check";

        /// <summary>
        /// The icon for data values.
        /// </summary>
        public const string DataValues = "icon-bulleted-list";

        /// <summary>
        /// Gets the icon for an entity.
        /// </summary>
        /// <param name="entityType">One of the <see cref="EntityTypes"/> values.</param>
        /// <param name="definitionIcon">The icon of the entity's definition, if it has one.</param>
        /// <returns>An Umbraco built-in icon name.</returns>
        public static string For(string entityType, string? definitionIcon)
        {
            var defaultIcon = GetDefault(entityType);

            // Folders and forms look the same whatever the definition says.
            if (defaultIcon == Folder || defaultIcon == Form || defaultIcon == Layout)
            {
                return defaultIcon;
            }

            return IsBuiltIn(definitionIcon) ? definitionIcon! : defaultIcon;
        }

        private static string GetDefault(string entityType)
        {
            return entityType switch
            {
                EntityTypes.FormsRoot or EntityTypes.DataValuesRoot or EntityTypes.ValidationsRoot => Folder,
                EntityTypes.FormFolder or EntityTypes.DataValuesFolder or EntityTypes.ValidationFolder => Folder,
                EntityTypes.Layout => Layout,
                EntityTypes.Validation => Validation,
                EntityTypes.DataValues => DataValues,
                _ => Form,
            };
        }

        private static bool IsBuiltIn(string? icon)
        {
            return icon is not null
                && icon.StartsWith(BuiltInPrefix, StringComparison.Ordinal)
                && !icon.StartsWith(LegacyPrefix, StringComparison.Ordinal);
        }
    }
}
