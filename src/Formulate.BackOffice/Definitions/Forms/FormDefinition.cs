namespace Formulate.BackOffice.Definitions.Forms
{
    using System;
    using Formulate.BackOffice.Api;

    public abstract class FormDefinition : IFormDefinition
    {
        public virtual string Icon => FormulateIcons.Form;

        public virtual string Description => string.Empty;

        public abstract Guid KindId { get; }

        public abstract string Name { get; }

        public virtual bool IsLegacy => false;
    }
}