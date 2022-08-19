﻿namespace Formulate.BackOffice.Utilities.CreateOptions.DataValues
{
    using Formulate.BackOffice.Controllers;
    using Formulate.Core.Persistence;
    using System.Collections.Generic;

    public interface IGetDataValuesChildEntityOptions
    {
        IReadOnlyCollection<CreateChildEntityOption> Get(IPersistedEntity? parent);
    }
}