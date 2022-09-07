﻿namespace Formulate.Core.FormHandlers.Email
{
    // Namespaces.
    using System;

    /// <summary>
    /// The data definition for a form handler that sends an email.
    /// </summary>
    public sealed class EmailDefinition : FormHandlerDefinition
    {
        /// <summary>
        /// Constants related to <see cref="EmailDefinition"/>.
        /// </summary>
        public static class Constants
        {
            /// <summary>
            /// The kind ID.
            /// </summary>
            public const string KindId = "A0C06033CB94424F9C035B10A420DB16";

            /// <summary>
            /// The name.
            /// </summary>
            public const string Name = "Email";

            /// <summary>
            /// The icon.
            /// </summary>
            public const string Icon = "icon-formulate-email";

            /// <summary>
            /// The Angular JS directive.
            /// </summary>
            public const string Directive = "formulate-email-handler";
        }

        /// <inheritdoc />
        public override string Category => FormHandlerConstants.Categories.Notify;

        /// <inheritdoc />
        public override string Directive => Constants.Directive;

        /// <inheritdoc />
        public override string Name => Constants.Name;

        /// <inheritdoc />
        public override Guid KindId => Guid.Parse(Constants.KindId);

        /// <inheritdoc />
        public override string Icon => Constants.Icon;

        /// <inheritdoc />
        public override FormHandler CreateHandler(IFormHandlerSettings settings)
        {
            var handler = new EmailHandler(settings);
            return handler;
        }

        /// <inheritdoc />
        public override object GetBackOfficeConfiguration(IFormHandlerSettings settings)
        {
            //TODO: Implement.
            return null;
        }
    }
}