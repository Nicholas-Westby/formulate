﻿namespace Formulate.BackOffice.Utilities.CreateOptions.FormFields
{
    using Formulate.BackOffice.Controllers;
    using Formulate.Core.FormFields;
    using System.Collections.Generic;
    using System.Linq;

    public sealed class GetFormFieldOptions : IGetFormFieldOptions
    {
        private readonly FormFieldDefinitionCollection _formFieldDefinitions;

        public GetFormFieldOptions(FormFieldDefinitionCollection formFieldDefinitions)
        {
            _formFieldDefinitions = formFieldDefinitions;
        }

        public IReadOnlyCollection<CreateItemOption> Get()
        {
            return _formFieldDefinitions.Where(x => x.IsLegacy == false).Select(x => new CreateItemOption()
            {
                Icon = x.Icon,
                KindId = x.KindId,
                Name = x.Name,
                Category = x.Category
            }).ToArray();
        }
    }
}