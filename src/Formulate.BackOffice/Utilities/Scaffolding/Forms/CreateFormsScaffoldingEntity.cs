﻿namespace Formulate.BackOffice.Utilities.Scaffolding.Forms
{
    using Formulate.Core.Folders;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Persistence;
    using System;
    using System.Collections.Generic;

    public sealed class CreateFormsScaffoldingEntity : ICreateFormsScaffoldingEntity
    {
        public IPersistedEntity? Create(CreateFormsScaffoldingEntityInput input)
        {
            var parent = input.Parent;
            var id = Guid.NewGuid();
            var entityPath = new List<Guid>();

            if (parent is not null)
            {
                entityPath.AddRange(parent.Path);
            }
            else
            {
                entityPath.Add(input.RootId);
            }

            entityPath.Add(id);


            if (input.EntityType == EntityTypes.Form)
            {
                return new PersistedForm()
                {
                    Id = id,
                    Path = entityPath.ToArray(),
                    Fields = Array.Empty<PersistedFormField>(),
                    Handlers = Array.Empty<PersistedFormHandler>()
                };
            }
            else if (input.EntityType == EntityTypes.Folder)
            {
                return new PersistedFolder()
                {
                    Id = id,
                    Path = entityPath.ToArray(),
                };
            }
            else if (input.EntityType == EntityTypes.Layout && input.KindId.HasValue)
            {
                return new PersistedLayout()
                {
                    Id = id,
                    Path = entityPath.ToArray(),
                    KindId = input.KindId.Value
                };
            }

            return default;
        }
    }
}